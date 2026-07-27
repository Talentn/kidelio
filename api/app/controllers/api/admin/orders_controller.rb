module Api
  module Admin
    class OrdersController < BaseController
      include OrderTrackingJson

      def index
        orders = Order.includes(:order_items, :user).order(created_at: :desc).limit(200)
        render json: { orders: orders.map { |o| admin_order_json(o) } }
      end

      def show
        order = Order
          .includes(:user, order_items: [ :product, { product: [ :colors, { images_attachments: :blob } ] } ])
          .find(params[:id])
        render json: { order: admin_order_json(order, detail: true) }
      end

      def update
        order = Order.find(params[:id])
        previous_status = order.status

        if order.update(order_params)
          # Capture before side effects: loyalty/stock updates save the order
          # again and would reset previous_changes.
          changes = order.previous_changes
          handle_status_change!(order, previous_status)
          intigo_warnings = IntigoParcelEditor.new(order).push_changes(changes)
          render json: {
            order: admin_order_json(order.reload, detail: true),
            intigo_warnings: intigo_warnings.presence
          }.compact
        else
          render json: { errors: order.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def destroy
        order = Order.find(params[:id])
        OrderDestroyer.new(order).call
        head :no_content
      rescue OrderDestroyer::Error => e
        render json: { errors: [ e.message ] }, status: :unprocessable_entity
      end

      # Retry / manual push to IntiGo when auto-create failed or was skipped.
      def send_to_intigo
        order = Order.find(params[:id])
        force = ActiveModel::Type::Boolean.new.cast(params[:force])

        if order.intigo_nid.present? && !force
          return render json: {
            errors: [ "Colis déjà créé sur Intigo (#{order.intigo_nid}). Relancez avec force=true pour en créer un nouveau." ],
            order: admin_order_json(order, detail: true)
          }, status: :unprocessable_entity
        end

        IntigoParcelCreator.new(order, force: force).call
        render json: { order: admin_order_json(order.reload, detail: true) }
      rescue IntigoParcelCreator::Error => e
        render json: {
          errors: [ e.message ],
          order: admin_order_json(order.reload, detail: true)
        }, status: :unprocessable_entity
      end

      # ── Line item edits (add / quantity / remove) ─────────────────────────

      def add_item
        edit_items do |editor|
          editor.add_item(
            product_id: params[:product_id],
            color_label: params[:color_label],
            size_label: params[:size_label],
            quantity: params[:quantity].presence || 1
          )
        end
      end

      def update_item
        edit_items { |editor| editor.update_quantity(params[:item_id], params[:quantity]) }
      end

      def remove_item
        edit_items { |editor| editor.remove_item(params[:item_id]) }
      end

      # Printable delivery slip — Intigo generates an HTML page and returns its URL.
      def bordereau
        order = Order.find(params[:id])
        if order.intigo_nid.blank?
          return render json: { errors: [ "Aucun colis Intigo pour cette commande" ] }, status: :unprocessable_entity
        end

        url = IntigoClient.new.bordereau_url([ order.intigo_nid ])
        if url.blank?
          return render json: { errors: [ "Intigo n'a pas renvoyé d'URL de bordereau" ] }, status: :unprocessable_entity
        end

        render json: { url: url }
      rescue IntigoClient::Error => e
        render json: { errors: [ e.message ] }, status: :unprocessable_entity
      end

      # Pull the parcel status from Intigo for one order.
      def sync_intigo
        order = Order.find(params[:id])
        IntigoStatusSync.new.sync_order!(order)
        render json: { order: admin_order_json(order.reload, detail: true) }
      rescue IntigoStatusSync::Error => e
        render json: {
          errors: [ e.message ],
          order: admin_order_json(order.reload, detail: true)
        }, status: :unprocessable_entity
      end

      # Pull parcel statuses from Intigo for every active order (bulk endpoint).
      def sync_intigo_all
        result = IntigoStatusSync.new.sync_all!
        render json: result
      rescue IntigoStatusSync::Error => e
        render json: { errors: [ e.message ] }, status: :unprocessable_entity
      end

      # Full Intigo parcel timeline (status changes, delivery/call attempts,
      # scans, address/phone changes). Fetched on demand, not stored.
      def intigo_history
        order = Order.find(params[:id])
        if order.intigo_nid.blank?
          return render json: { errors: [ "Aucun colis Intigo pour cette commande" ] }, status: :unprocessable_entity
        end

        history = IntigoClient.new.parcel_history(order.intigo_nid)
        render json: { nid: order.intigo_nid, history: history }
      rescue IntigoClient::Error => e
        render json: { errors: [ e.message ] }, status: :unprocessable_entity
      end

      # Re-delivery request (IVR) — only valid when Intigo status is 2100.
      # Returns fee_required: true when Intigo asks to accept a relance fee;
      # the UI confirms and retries with accept_fee=true.
      def relance_intigo
        order = Order.find(params[:id])
        if order.intigo_nid.blank?
          return render json: { errors: [ "Aucun colis Intigo pour cette commande" ] }, status: :unprocessable_entity
        end

        accept_fee = ActiveModel::Type::Boolean.new.cast(params[:accept_fee])
        response = IntigoClient.new.relance_parcel(order.intigo_nid, accept_fee: accept_fee)

        begin
          IntigoStatusSync.new.sync_order!(order)
        rescue IntigoStatusSync::Error
          # Relance succeeded; the status refresh is best-effort.
        end

        render json: {
          message: response["message"].presence || "Relance demandée",
          order: admin_order_json(order.reload, detail: true)
        }
      rescue IntigoClient::Error => e
        if e.status == 402
          render json: { fee_required: true, message: e.message }
        else
          order.update_columns(intigo_last_error: e.message.truncate(2000), updated_at: Time.current)
          render json: {
            errors: [ e.message ],
            order: admin_order_json(order.reload, detail: true)
          }, status: :unprocessable_entity
        end
      end

      private

      # Runs an OrderItemsEditor operation, pushes the new COD total to Intigo
      # when a parcel exists, and renders the refreshed order.
      def edit_items
        order = Order.find(params[:id])
        yield(OrderItemsEditor.new(order))
        intigo_warnings = IntigoParcelEditor.new(order).push_changes(order.previous_changes)
        render json: {
          order: admin_order_json(order.reload, detail: true),
          intigo_warnings: intigo_warnings.presence
        }.compact
      rescue OrderItemsEditor::Error, ActiveRecord::RecordNotFound => e
        message = e.is_a?(ActiveRecord::RecordNotFound) ? "Article introuvable" : e.message
        render json: {
          errors: [ message ],
          order: order ? admin_order_json(order.reload, detail: true) : nil
        }.compact, status: :unprocessable_entity
      end

      def order_params
        permitted = params.permit(
          :status, :notes,
          :guest_name, :guest_phone, :guest_email,
          :shipping_governorate, :shipping_delegation, :shipping_address,
          :intigo_city_id, :intigo_district_id,
          :intigo_can_open, :intigo_is_exchange
        )
        %i[intigo_city_id intigo_district_id].each do |key|
          permitted[key] = permitted[key].presence&.to_i if permitted.key?(key)
        end
        %i[intigo_can_open intigo_is_exchange].each do |key|
          permitted[key] = ActiveModel::Type::Boolean.new.cast(permitted[key]) if permitted.key?(key)
        end
        permitted
      end

      def handle_status_change!(order, previous_status)
        OrderStatusSideEffects.apply!(order, previous_status)
      end

      def admin_order_json(order, detail: false)
        json = {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          status_label: OrderTrackingJson::STATUS_LABELS[order.status] || "Statut inconnu",
          guest_name: order.guest_name,
          guest_phone: order.guest_phone,
          guest_email: order.guest_email,
          subtotal: order.subtotal,
          shipping_cost: order.shipping_cost,
          discount_amount: order.discount_amount,
          total: order.total,
          payment_method: order.payment_method,
          created_at: order.created_at,
          intigo_nid: order.intigo_nid,
          intigo_sent_at: order.intigo_sent_at,
          intigo_last_error: order.intigo_last_error,
          intigo_status: order.intigo_status,
          intigo_status_label: order.intigo_status_label,
          intigo_synced_at: order.intigo_synced_at,
          intigo_delivery_attempts: order.intigo_delivery_attempts,
          intigo_can_open: order.intigo_can_open,
          intigo_is_exchange: order.intigo_is_exchange,
          user: order.user&.slice(:id, :name, :email)
        }
        if detail
          json.merge!(
            shipping_governorate: order.shipping_governorate,
            shipping_delegation: order.shipping_delegation,
            shipping_address: order.shipping_address,
            intigo_city_id: order.intigo_city_id,
            intigo_district_id: order.intigo_district_id,
            items: order.order_items.map { |i| order_item_json(i) }
          )
        end
        json
      end

      def order_item_json(item)
        product = item.product
        item.slice(:id, :product_id, :product_name, :quantity, :unit_price, :size_label, :color_label).merge(
          product_slug: item.product_slug || product&.slug,
          product_available: product.present? && product.active,
          image_url: product ? json_variant_url(product.listing_image_attachments.first, size: :thumb) : nil
        )
      end
    end
  end
end
