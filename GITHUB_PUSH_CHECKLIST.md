# GitHub Push Checklist

## ✅ Files to PUSH

### Backend (All Source Code)
- [ ] backend/src/**/*.js (all JavaScript files)
- [ ] backend/package.json
- [ ] backend/Dockerfile
- [ ] backend/.dockerignore

### Frontend (All Source Code)
- [ ] frontend/src/**/*.jsx (all React files)
- [ ] frontend/public/**/*
- [ ] frontend/package.json
- [ ] frontend/vite.config.js
- [ ] frontend/index.html
- [ ] frontend/Dockerfile
- [ ] frontend/nginx.conf
- [ ] frontend/.dockerignore

### Terraform (Config Only)
- [ ] terraform/main.tf
- [ ] terraform/variables.tf
- [ ] terraform/outputs.tf
- [ ] terraform/terraform.tfvars.example (NOT terraform.tfvars!)

### Database
- [ ] database/schema.sql

### Documentation
- [ ] README.md
- [ ] PANDUAN_DEPLOYMENT_GCP_UNIVERSAL.md
- [ ] TUTORIAL_DEPLOY_ITERARY_LENGKAP.md
- [ ] .gitignore

## ❌ Files to EXCLUDE

### Never Push These!
- [ ] ❌ node_modules/ (any folder)
- [ ] ❌ .env (any .env files)
- [ ] ❌ terraform/terraform.tfvars (HAS PASSWORDS!)
- [ ] ❌ terraform/.terraform/ (auto-generated)
- [ ] ❌ terraform/*.tfstate (HAS PRIVATE IPS!)
- [ ] ❌ frontend/dist/ (build output)
- [ ] ❌ *.zip files
- [ ] ❌ baca.txt, produk.sql, stok_cabang.sql

## 🔍 Verification Commands

Check what will be pushed:
```bash
git status
git diff --cached
```

Check .gitignore is working:
```bash
git status | grep -E "node_modules|\.env|tfstate|terraform\.tfvars"
# Should return NOTHING (all ignored)
```

List all tracked files:
```bash
git ls-files
```

## 🚨 CRITICAL CHECKS

Before pushing, verify:
1. [ ] No passwords in any committed file
2. [ ] No API keys or secrets
3. [ ] No .env files
4. [ ] No terraform.tfvars (only .example)
5. [ ] No terraform.tfstate files
6. [ ] No node_modules folders
7. [ ] README.md exists and complete
8. [ ] .gitignore exists and working

## 📊 Expected File Count

Approximate files to be pushed:
- Backend: ~15-20 files
- Frontend: ~30-40 files
- Terraform: ~4 files
- Database: ~1 file
- Docs: ~4 files
- Total: ~60-70 files

## 🎯 Final Check

Run this before push:
```bash
# Count files to be committed
git ls-files | wc -l

# Search for sensitive data
git grep -i "password" 
git grep -i "secret"
git grep -i "private"

# If any sensitive data found, STOP and fix!
```
