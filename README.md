# Flame

<img src="https://github.com/stallpool/flame/raw/master/client/icon.png" alt="FlameLogo" width="72" height="72" />

a service for source code repository indexing like OpenGrok but in JavaScript

### Install

```
git clone https://github.com/stallpool/flame
cd flame
npm install
node server/index.js
# flame works at http://127.0.0.1:20180 by default
```

##### Environment Variables
- `NODE_TLS_REJECT_UNAUTHORIZED`: if connect to self-signed https site
- `FLAME_DEBUG`: debug mode; enable to serve static files
- `FLAME_ADMINS`: comma-separated list of admins
- `FLAME_LDAP_SERVER`: ldap server for user authentication
- `FLAME_KEYVAL_FILENAME`: backup in-memory key-value database into a file
- `FLAME_METADATA_BASE`: where source file metadata are stored

##### `FLAME_METADATA_BASE` Example

Say we have a file of `/project/path/to/file` and `FLAME_METADATA_BASE` is set to `/data`;

Then metadata module will try to read `/data/project/path/to/file/_` as source code `info`:

```
{
   "tokens": [
      {"startOffset":8, "endOffset":17, "description": "import trollop", "uol": "https://github.com/karlwilbur/trollop"},
      {"startOffset":1444, "endOffset":1459, "description": "class XException < StandardError", "uol": "#/nimbus/lib/nimbusException.rb?lineno=7"},
      {"startOffset":10841, "endOffset":10861, "description": "class PartialFail < XException", "uol": "?offset=1421&n=20"},
      {"startOffset":94351, "endOffset":94371, "description": "class PartialFail < XException", "uol": "?offset=1421&n=20"},
      {"startOffset":94977, "endOffset":94997, "description": "class PartialFail < XException", "uol": "?offset=1421&n=20"},
      {"startOffset":95669, "endOffset":95689, "description": "class PartialFail < XException", "uol": "?offset=1421&n=20"},
      {"startOffset":95955, "endOffset":95975, "description": "class PartialFail < XException", "uol": "?offset=1421&n=20"}
   ]
}
```

The first token refers to external URL; the second refers to another file; meanwhile, the others refer to infile token.


### Configuration

> open browser, login to http://127.0.0.1:20180 and get cookie string of `flame_username` and `flame_uuid`
> notice: `flame_username` should in `FLAME_ADMINS`

##### OpenGrok
- run an instance of OpengGrok and get its url for example `https://xxxxxxxxxx/opengrok`
- run
    ```
    # no auth
    curl http://127.0.0.1:20180/api/metasearch/admin/register \
       -d '{"username":"<flame_username>", "uuid": "<flame_uuid>", "metatype": "opengrok", "base_url": "https://xxxxxxxxxx/opengrok", "security_mode":"noauth"}'

    # basic auth
    curl http://127.0.0.1:20180/api/metasearch/admin/register \
       -d '{"username":"<username>", "uuid": "<uuid>", "metatype": "opengrok", "base_url": "https://xxxxxxxxxx/opengrok", "security_mode":"basic", "version": "1.x", "auth": {"username": "<static_username>", "password": "<static_password>"}}'

    # tomcat ldap / jsecurity
    curl http://127.0.0.1:20180/api/metasearch/admin/register \
       -d '{"username":"<username>", "uuid": "<uuid>", "metatype": "opengrok", "base_url": "https://xxxxxxxxxx/opengrok", "security_mode":"jsecurity", "version": "0.x", "auth": {"username": "<ldap_username>", "password": "<password>"}}'
    ```
- check if instance registered `curl http://127.0.0.1:20180/api/metasearch/admin/list -d '{"username":"<flame_username>", "uuid": "<flame_uuid>"}'`

##### ElasticSearch
- prepare source code in a specified folder for example `/data`
- run an instance of ElasticSearch and get its url for example `https://xxxxxxxxxx/es`
- run `node indexer/cli/latest_lines_to_es.js /data --host https://xxxxxxxxxx/es` to extract lines into ElasticSearch
- run
    ```
    curl http://127.0.0.1:20180/api/metasearch/admin/register \
       -d '{"username":"<flame_username>", "uuid": "<flame_uuid>", "metatype": "elasticsearch", "base_url": "https://xxxxxxxxxx/es", "security_mode":"noauth"}'
    ```
- check if instance registered `curl http://127.0.0.1:20180/api/metasearch/admin/list -d '{"username":"<flame_username>", "uuid": "<flame_uuid>"}'`

### APIs

##### grant/revoke access to specified project for user

```
curl http://127.0.0.1:20180/api/acl/admin/get_access       -d '{"username":"<username>", "uuid": "<uuid>", "target_username": "<username>"}'
curl http://127.0.0.1:20180/api/acl/admin/grant_access_to  -d '{"username":"<username>", "uuid": "<uuid>", "target_username": "<username>", "project": "<project>"}'
curl http://127.0.0.1:20180/api/acl/admin/revoke_access_to -d '{"username":"<username>", "uuid": "<uuid>", "target_username": "<username>", "project": "<project>"}'
```

### Screenshot

<img src="https://github.com/stallpool/flame/raw/master/document/images/viewer.png" alt="FlameLogo" width="520" />
<img src="https://github.com/stallpool/flame/raw/master/document/images/search.png" alt="FlameLogo" width="520" />
