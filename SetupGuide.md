# Resort Management System — Setup Guide

## Prerequisites

Install the following:
1. Node.js (LTS)
2. MySQL 8.0
3. Git
4. Access to the project's Neo4j Aura database credentials

## Step 1: Clone the repository

```powershell
git clone https://github.com/aadityaV-goat/DBMS_miniproject_CS004_CS060.git
cd DBMS_miniproject_CS004_CS060
```

## Step 2: Set up the MySQL database

Open **MySQL Command Line Client** and log in as root.

Run the SQL scripts in this exact order:

```sql
SOURCE C:/path/to/project/database/01_schema.sql;
SOURCE C:/path/to/project/database/02_seed_data.sql;
SOURCE C:/path/to/project/database/03_auth.sql;
SOURCE C:/path/to/project/database/04_advanced_features.sql;
```

Replace `C:/path/to/project/` with the actual absolute project path.

Verify:

```sql
USE resort_entries;
SHOW TABLES;
```

## Step 3: Configure the application database user

Run in MySQL:

```sql
SOURCE C:/path/to/project/database/05_app_user.sql;
```

Use the credentials defined in that script when configuring the application.

## Step 4: Install dependencies

In PowerShell, from the project root:

```powershell
npm install
```

## Step 5: Configure environment variables

Create the local environment file:

```powershell
Copy-Item .env.example .env.local
```

Open `.env.local` and configure:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=resort_app
DB_PASSWORD=your_mysql_password
DB_NAME=resort_entries

NEO4J_URI=your_neo4j_aura_uri
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_neo4j_password
NEO4J_DATABASE=neo4j

AUTH_SECRET=your_long_random_secret
SEED_ADMIN_PASSWORD=your_admin_password
SEED_STAFF_PASSWORD=your_staff_password
```

Do not commit `.env.local` or share passwords publicly.

## Step 6: Seed authentication accounts

```powershell
npm run seed:users
```

This creates the initial admin and staff accounts.

## Step 7: Start the development server

```powershell
npm run dev
```

Open the local URL displayed in the terminal, usually:

http://localhost:3000

## Step 8: Verify database connectivity

Open:

```text
http://localhost:3000/api/health
```

Expected: MySQL and Neo4j should both report `"ok": true`.

## Login accounts

Use the usernames and passwords configured through the seed script:

- Admin username: `admin`
- Staff username: `reception`

