#!/bin/bash

set -e
set -o pipefail

main() {
    echo "Running"
    env=$1
    # aws cloudformation package --template-file ../template.yaml --s3-bucket research-central --output-template-file sam-output-template.yaml
    sam package --template-file ../template.yaml --s3-bucket research-central --output-template-file sam-output-template.yaml
    sam deploy --stack-name dev-elevator-queue-service --template-file sam-output-template.yaml --capabilities CAPABILITY_NAMED_IAM --parameter-overrides Env=dev --profile elevator
    # aws cloudformation deploy 
}

main $1