.PHONY: doctor setup dev check check-e2e

doctor:
	./scripts/doctor.sh

setup:
	./scripts/setup.sh

dev:
	./scripts/dev.sh

check:
	./scripts/check.sh

check-e2e:
	RUN_E2E=1 ./scripts/check.sh
