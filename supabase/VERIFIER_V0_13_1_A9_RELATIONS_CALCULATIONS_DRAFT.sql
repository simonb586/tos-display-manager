-- Lecture seule, exécution manuelle ultérieure.
select proname,prosecdef,proconfig,pg_catalog.pg_get_userbyid(proowner)owner from pg_catalog.pg_proc where proname like'%draft_v0131a9';
