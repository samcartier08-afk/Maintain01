.PHONY: all run test seed demo clean lint

all: test

run:
	npm run dev

test:
	python3 -m unittest discover -s tests -p "test_*.py"

seed:
	python3 -m data.generators.seed

demo: seed
	python3 -m tests.demo_walkthrough

lint:
	npm run lint

clean:
	rm -rf __pycache__ */__pycache__ */*/__pycache__ .pytest_cache data/metrics.json data/ground_truth.json
