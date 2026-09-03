from bdd_api.config import Settings


def test_platform_postgres_urls_get_the_psycopg_dialect() -> None:
    """Render, Heroku and Railway inject `postgres://` or `postgresql://`.

    SQLAlchemy dropped the `postgres` alias, and a driverless `postgresql://`
    reaches for psycopg2 rather than the psycopg 3 this project installs, so
    both forms break at startup unless they are rewritten first.
    """
    render_style = "postgres://bdd:pw@dpg-abc.oregon-postgres.render.com/bdd"
    assert Settings(database_url=render_style).database_url == (
        "postgresql+psycopg://bdd:pw@dpg-abc.oregon-postgres.render.com/bdd"
    )
    assert Settings(database_url="postgresql://bdd:pw@host/bdd").database_url == (
        "postgresql+psycopg://bdd:pw@host/bdd"
    )


def test_already_correct_urls_are_left_alone() -> None:
    for url in ("postgresql+psycopg://bdd:pw@host/bdd", "sqlite:///data/bdd.db"):
        assert Settings(database_url=url).database_url == url
