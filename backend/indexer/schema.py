def search_index_mapping() -> dict:
    return {
        "settings": {
            "index": {"number_of_shards": 1, "number_of_replicas": 0},
            "analysis": {"analyzer": {"default": {"type": "standard"}}},
        },
        "mappings": {
            "properties": {
                "url": {"type": "keyword"},
                "title": {"type": "text"},
                "body": {"type": "text"},
                "summary": {"type": "text"},
                "updated_at": {"type": "date"},
            }
        },
    }
