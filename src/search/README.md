```
contents -> file(doc)
file(doc) -> hash -> index
index -> key-val -> doc
query -> (transform) -> key tree -> key-val

DocIndexer
self.get(hash) -> urls, data
self.hash(url, data) -> hash
self.validate(url, data, hash)
self.indexAdd(url, data, hash)
self.indexDel(url, data, hash)

KeyValIndexer
self.doc(hash) -> index
self.indexAdd(index, hash)
self.indexDel(index, hash)
self.search(key_trees) -> [hash]

KeyValTable
self.put(key, hash, score)
self.get(key, N) -> [(hash, score)]

QueryTransformer
self.parse(query) -> key_trees
```
