project_dir=pebbling

main: venv/bin/activate

dev: venv/bin/activate
	. venv/bin/activate && \
	cd $(project_dir) && \
	python manage.py runserver

shell:
	. venv/bin/activate && \
	cd $(project_dir) && \
	python manage.py shell

test: venv/bin/activate
	. venv/bin/activate && \
	cd $(project_dir) && \
	python manage.py test

format:
	python -m black .

migrate:
	. venv/bin/activate && \
	cd $(project_dir) && \
	python manage.py migrate

freeze:
	. venv/bin/activate && \
	python -m pip freeze > requirements.txt

upgrade: requirements.txt
	. venv/bin/activate && \
	python -m pip install -r requirements.txt

venv/bin/activate: requirements.txt
	test -d venv || python -m venv venv
	touch venv/bin/activate && \
	. venv/bin/activate && \
	python -m pip install --upgrade pip && \
	pip install -r requirements.txt
