project_dir=djangotutorial

main: venv/bin/activate

runserver: venv/bin/activate
	cd $(project_dir) && \
	python manage.py runserver

shell:
	cd $(project_dir) && \
	python manage.py shell

migrate:
	cd $(project_dir) && \
	python manage.py migrate

freeze:
	python -m pip freeze > requirements.txt

upgrade: requirements.txt
	python -m pip install -r requirements.txt

venv/bin/activate: requirements.txt
	test -d venv || python -m venv venv
	touch venv/bin/activate && \
	source venv/bin/activate && \
	python -m pip install --upgrade pip && \
	pip install -r requirements.txt
