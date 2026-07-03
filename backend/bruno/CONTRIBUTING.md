# Updating the Bruno Collection

When you add or modify API endpoints, update this Bruno collection:

## Adding a New Endpoint

1. **Create a new `.bru` file** in the appropriate folder:
   - Public endpoints → `Meteoblick API/`
   - Weather endpoints → `Meteoblick API/Weather/`
   - POI endpoints → `Meteoblick API/POIs/`
   - Admin endpoints → `Meteoblick API/Admin/`

2. **Use this template:**

```bru
meta {
  name: Your Endpoint Name
  type: http
  seq: X
}

get {
  url: {{baseUrl}}/api/your-path
  body: none
  auth: none
}

params:query {
  ~optionalParam: value
  requiredParam: value
}

docs {
  Description of what this endpoint does.

  Include examples and important notes.
}
```

3. **For authenticated endpoints:**

```bru
auth: bearer

auth:bearer {
  token: {{adminToken}}
}
```

## Modifying Existing Endpoints

1. Update the corresponding `.bru` file
2. Test the request in Bruno
3. Update docs if behavior changed

## Environment Variables

- Add new variables to **both** `Local.bru` and `Production.bru`
- Update `Local.example.bru` for documentation
- Never commit real tokens/secrets

## Checklist

- [ ] `.bru` file created/updated
- [ ] Tested in Bruno with Local environment
- [ ] Docs section filled with examples
- [ ] Environment variables added if needed
- [ ] Sequence number (`seq`) is unique in folder
