#!/bin/sh
set -e

ES_URL="http://elasticsearch:9200"
TEMPLATE_NAME="app-logs"
TEMPLATE_FILE="/etc/elasticsearch/index-template.json"

echo "Applying Elasticsearch index template '${TEMPLATE_NAME}'..."

curl -sf -X PUT "${ES_URL}/_index_template/${TEMPLATE_NAME}" \
  -H 'Content-Type: application/json' \
  -d @"${TEMPLATE_FILE}"

echo ""
echo "Index template '${TEMPLATE_NAME}' applied."
