# Instructions to Push Code to GitHub

## Prerequisites
1. Make sure Git is installed on your system. If not, download it from: https://git-scm.com/download/win
2. Make sure you have a GitHub account and are logged in.

## Steps to Push Code

### 1. Open Terminal/Command Prompt in the project directory
Navigate to: `D:\Telefonak`

### 2. Initialize Git (if not already initialized)
```bash
git init
```

### 3. Add the remote repository
```bash
git remote add origin https://github.com/Karamelloo/Telefonak.git
```

If the remote already exists, update it with:
```bash
git remote set-url origin https://github.com/Karamelloo/Telefonak.git
```

### 4. Create a .gitignore file (if it doesn't exist)
Create a `.gitignore` file in the root directory with:
```
node_modules/
.env
*.log
.DS_Store
backend/uploads/*
!backend/uploads/.gitkeep
mobile/.expo/
.expo/
```

### 5. Add all files
```bash
git add .
```

### 6. Commit the changes
```bash
git commit -m "Add bilingual support (Arabic/English) with RTL layout, translate all screens including admin dashboard, fix Terms of Use translations"
```

### 7. Set the default branch (if needed)
```bash
git branch -M main
```

### 8. Push to GitHub
```bash
git push -u origin main
```

If you encounter authentication issues, you may need to:
- Use a Personal Access Token instead of password
- Or set up SSH keys

## Alternative: Using GitHub Desktop
If you prefer a GUI, you can:
1. Download GitHub Desktop: https://desktop.github.com/
2. Open the repository in GitHub Desktop
3. Click "Publish repository" or "Push origin"

## Troubleshooting

### If you get "remote origin already exists" error:
```bash
git remote remove origin
git remote add origin https://github.com/Karamelloo/Telefonak.git
```

### If you need to authenticate:
GitHub no longer accepts passwords. You'll need to:
1. Create a Personal Access Token: https://github.com/settings/tokens
2. Use the token as your password when pushing

### If you get "fatal: not a git repository":
Make sure you're in the correct directory and run `git init` first.

