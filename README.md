# pebbling-club (django version)

## development notes

Trying to jot down notes of needful things before productivity occurs.
Some of this will end up unnecessary after initial commit.

I'm trying to bundle common tasks up into a Makefile
```bash
make # install dependencies
make runserver # run development server
```

```bash
# create virtual environment (if not already created)
python -m venv venv

# activate virtual environment
. ./venv/bin/activate

# upgrade pip (if needed)
pip install --upgrade pip

# install dependencies
python -m pip install -r requirements.txt
```

When installing packages:
```bash
pip freeze > requirements.txt
```

## TODO

- [ ] get code linting and formatting working
- [ ] get some kind of type system working?
