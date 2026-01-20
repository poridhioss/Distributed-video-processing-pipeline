# Variables
REGISTRY ?= your-dockerhub-username
TAG ?= v1.0.0

PRODUCER_IMAGE = $(REGISTRY)/producer:$(TAG)
CONSUMER_IMAGE = $(REGISTRY)/consumer:$(TAG)

.PHONY: build producer consumer push-producer push-consumer push clean

build: producer consumer

producer:
	docker build -t $(PRODUCER_IMAGE) ./producer

consumer:
	docker build -t $(CONSUMER_IMAGE) ./consumer

push: push-producer push-consumer

push-producer:
	docker push $(PRODUCER_IMAGE)

push-consumer:
	docker push $(CONSUMER_IMAGE)

clean:
	docker rmi $(PRODUCER_IMAGE) $(CONSUMER_IMAGE) || true
