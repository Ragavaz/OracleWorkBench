# Catalog JSON schema (write exactly this shape)

{
  "area": "HCM",                      // short area code
  "title": "Oracle Fusion Cloud HCM",
  "generated": "2026-10-29",
  "sources": [ { "title": "...", "url": "https://docs.oracle.com/..." } ],
  "categories": [
    {
      "id": "hcm-core-rest",          // kebab-case, unique
      "name": "Core HR REST resources",
      "description": "one or two sentences",
      "items": [
        {
          "id": "hcm-workers",        // kebab-case, unique across file
          "name": "Workers",
          "kind": "rest",             // rest | soap | hdl | fbdi | formula | sql | extract | atom | oic | oci | vbs | groovy | xslt | concept | ess | bip
          "summary": "What it is for, 1-2 sentences, plain English",
          "method": "GET",            // REST/SOAP only; may be "GET, POST, PATCH"
          "path": "/hcmRestApi/resources/11.13.18.05/workers",   // REST path, SOAP endpoint path, HDL file name, CLI verb, etc.
          "children": ["names", "emails", "workRelationships"],  // optional: child resources / components
          "keyFields": ["PersonId", "PersonNumber"],              // optional
          "docUrl": "https://docs.oracle.com/...",                 // the exact page you read
          "verified": true,           // true ONLY if you read this on an Oracle page in this session
          "notes": "gotchas, version notes, required headers",
          "examples": [ { "title": "Get one worker with names", "lang": "http", "code": "GET /hcmRestApi/...\n..." } ]
        }
      ]
    }
  ],
  "cookbook": [
    {
      "id": "hcm-newhire-oic-hdl",
      "title": "New hire from an external system via OIC and HDL",
      "module": "HCM",
      "level": "intermediate",        // starter | intermediate | advanced
      "problem": "1-2 sentences",
      "prerequisites": ["..."],
      "steps": [ "Step text 1", "Step text 2" ],
      "examples": [ { "title": "...", "lang": "xml|json|http|sql|bash|groovy|js|text", "code": "..." } ],
      "testing": ["how to verify it worked"],
      "rollback": ["how to undo"],
      "docUrls": ["https://docs.oracle.com/..."]
    }
  ]
}

Rules
- Valid JSON (no comments). UTF-8. Keep the file under 90 KB.
- Never invent resource names, attribute names, job names, table names or UI paths. If you cannot confirm something on an Oracle page, either leave it out or set verified:false and say what to check in notes.
- Use placeholders for hosts/IDs/credentials: https://{pod}.fa.{region}.oraclecloud.com, <oic-host>, 300000012345678, $TOKEN.
- Examples must be syntactically valid and minimal. No real customer data.
