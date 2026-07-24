from .gangs import bp as gangs_bp
from .gang_edit_requests import bp as gang_edit_requests_bp
from .disband_requests import bp as disband_requests_bp
from .pause_requests import bp as pause_requests_bp
from .uniform_files import bp as uniform_files_bp
from .welfare_requests import bp as welfare_requests_bp
from .welfare_items import bp as welfare_items_bp
from .council_users import bp as council_users_bp
from .admin_users import bp as admin_users_bp
from .welfare_season_management import bp as welfare_season_management_bp
from .root_login import bp as root_login_bp


def register_routes(app):
    app.register_blueprint(gangs_bp)
    app.register_blueprint(gang_edit_requests_bp)
    app.register_blueprint(disband_requests_bp)
    app.register_blueprint(pause_requests_bp)
    app.register_blueprint(uniform_files_bp)
    app.register_blueprint(welfare_requests_bp)
    app.register_blueprint(welfare_items_bp)
    app.register_blueprint(council_users_bp)
    app.register_blueprint(admin_users_bp)
    app.register_blueprint(welfare_season_management_bp)
    app.register_blueprint(root_login_bp)
