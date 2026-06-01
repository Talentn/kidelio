module Store
  class BaseController < ApplicationController
    include CartAccess
    layout "store"
  end
end
