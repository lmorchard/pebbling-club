.PHONY: dev

dev: venv/bin/activate
	. venv/bin/activate \
	&& honcho start -f Procfile-dev

serve: venv/bin/activate
	. venv/bin/activate \
	&& python manage.py runserver

worker: venv/bin/activate
	. venv/bin/activate \
	&& celery -A pebbling worker --loglevel=info

shell:
	. venv/bin/activate \
	&& python manage.py shell

test: venv/bin/activate
	. venv/bin/activate \
	&& python manage.py test

format: venv/bin/activate
	. venv/bin/activate \
	&& python -m black . \
	&& djlint pebbling pebbling_apps --reformat

migrate: venv/bin/activate
	. venv/bin/activate \
	&& mkdir -p data \
	&& python manage.py createcachetable --database cache_db \
	&& python manage.py migrate --database=celery_db \
	&& python manage.py migrate --database=feeds_db \
	&& python manage.py migrate

freeze:
	. venv/bin/activate \
	&& python -m pip freeze > requirements.txt

venv/bin/activate: requirements.txt npm-install
	test -d venv || python -m venv venv
	touch venv/bin/activate \
	&& . venv/bin/activate \
	&& python -m pip install --upgrade pip \
	&& pip install -r requirements.txt

npm-install: package.json node_modules/.keep
	cd frontend && npm install

node_modules/.keep:
	mkdir -p node_modules && touch node_modules/.keep
