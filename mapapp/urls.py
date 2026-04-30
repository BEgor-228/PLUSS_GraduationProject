from django.urls import path

from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("district/<int:district_id>/", views.district_page, name="district_page"),
    path("institution/new/", views.institution_create_page, name="institution_create_page"),
    path("institution/<int:institution_id>/edit/", views.institution_edit_page, name="institution_edit_page"),
    path("admin/", views.index, name="admin_ui"),
    path("api/get_districts.php", views.get_districts),
    path("api/get_links.php", views.get_links),
    path("api/get_institutions.php", views.get_institutions),
    path("api/get_institution.php", views.get_institution),
    path("api/get_directors.php", views.get_directors),
    path("api/get_director.php", views.get_director),
    path("api/login.php", views.login),
    path("api/logout.php", views.logout),
    path("api/check_session.php", views.check_session),
    path("api/register.php", views.register),
    path("api/create_institution.php", views.create_institution),
    path("api/update_institution.php", views.update_institution),
    path("api/delete_institution.php", views.delete_institution),
]
