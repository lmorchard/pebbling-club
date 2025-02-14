project_dir=pebbling

.PHONY: serve

dev: venv/bin/activate
	. venv/bin/activate \
	&& cd $(project_dir) \
	&& honcho start -f Procfile-dev

serve: venv/bin/activate
	. venv/bin/activate \
	&& cd $(project_dir) \
	&& python manage.py runserver

worker: venv/bin/activate
	. venv/bin/activate \
	&& cd $(project_dir) \
	&& celery -A core worker --loglevel=info

shell:
	. venv/bin/activate \
	&& cd $(project_dir) \
	&& python manage.py shell

test: venv/bin/activate
	. venv/bin/activate \
	&& cd $(project_dir) \
	&& python manage.py test

format: venv/bin/activate
	. venv/bin/activate \
	&&python -m black . \
	&& djlint pebbling --reformat

migrate: venv/bin/activate
	. venv/bin/activate \
	&& cd $(project_dir) \
	&& python manage.py migrate django_celery_results  --database=celery_db \
	&& python manage.py migrate django_celery_beat --database=celery_db \
	&& python manage.py createcachetable --database=cache_db \
	&& python manage.py migrate

freeze:
	. venv/bin/activate \
	&& python -m pip freeze > requirements.txt

upgrade: requirements.txt
	. venv/bin/activate \
	&& python -m pip install -r requirements.txt

venv/bin/activate: requirements.txt
	test -d venv || python -m venv venv
	touch venv/bin/activate \
	&& . venv/bin/activate \
	&& python -m pip install --upgrade pip \
	&& pip install -r requirements.txt
