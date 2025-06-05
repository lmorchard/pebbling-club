.PHONY: dev verify-uv

verify-uv:
	@echo "Creating and executing uv verification script..."
	@cat << 'EOF' > /tmp/verify_uv.sh
	#!/bin/bash
	set -e
	echo "Starting uv verification script execution..."

	PYTHON_EXECUTABLE=$$(which python3.11 || which python3 || echo "python")
	echo "Using Python: $$PYTHON_EXECUTABLE"

	echo "Creating virtual environment with uv..."
	uv venv --python $$PYTHON_EXECUTABLE .venv-test-uv
	if [ ! -f ".venv-test-uv/bin/activate" ]; then
	    echo "Failed to create virtual environment. .venv-test-uv/bin/activate not found."
	    ls -la .venv-test-uv
	    if [ -d ".venv-test-uv/bin" ]; then
	      ls -la .venv-test-uv/bin
	    fi
	    exit 1
	fi
	echo "Virtual environment created."

	echo "Activating virtual environment..."
	source .venv-test-uv/bin/activate
	echo "Virtual environment activated."

	echo "Attempting to install dependencies with uv pip sync..."
	uv pip sync requirements.txt
	echo "Dependencies installed."

	echo "uv version:"
	uv --version
	echo "Django version:"
	python -m django --version
	echo "Successfully created venv and installed dependencies with uv."

	echo "Deactivating and cleaning up..."
	deactivate
	rm -rf .venv-test-uv
	echo "Cleaned up test virtual environment."
	echo "uv verification script execution completed."
	EOF
	@chmod +x /tmp/verify_uv.sh
	@echo "Running the script..."
	@/tmp/verify_uv.sh
	@echo "Script execution finished."

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

test:
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
	&& uv pip freeze > requirements.txt

venv/bin/activate: requirements.txt npm-install
	test -d venv || python -m venv venv
	touch venv/bin/activate \
	&& . venv/bin/activate \
	&& uv pip sync requirements.txt

npm-install: package.json node_modules/.keep
	cd frontend && npm install

node_modules/.keep:
	mkdir -p node_modules && touch node_modules/.keep
