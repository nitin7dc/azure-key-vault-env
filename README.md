# azure-key-vault-env
Manage your environment variables using azure key vault.

### Problem
When your application has many environment variables, they 
become difficult to manage. 

Sharing long env file with team members and then sharing again when new updates are there.
Managing multiple environemnt (local, demo, staging, production,...) again introduces some more challenges.


### Solution
If you are already using azure, manage your environment variables using key vault. It's a good service with many
benefits. [(learn more)](https://azure.microsoft.com/en-us/services/key-vault/)
- create a azure key vault.
- create a service principal with access to above key vault.
- use this package to set up and load env.

### Installation

```
npm install azure-key-vault-env
```

### Usage
Send all your environment variables to your azure key vault.

```bash

// azure-key-vault-env expects the following environment variables
// KEY_VAULT_URI: The keyvault uri in Azure
// AZURE_TENANT_ID: The tenant ID in Azure Active Directory
// AZURE_CLIENT_ID: The application (client) ID registered in the AAD tenant
// AZURE_CLIENT_SECRET: The client secret for the registered application

const manager = require('azure-key-vault-env');

// Your environment variables.
const envKeys = {
       
    // Database    
    DB_HOST: '',
    DB_NAME: '',
    DB_USER: '',
    DB_PASS: '',

    // Any other variables
} 

const result = await manager.setup({ envKeys });

```

### Load Variables in your app.
 
```bash
const manager = require('environment-manager');
const result = await manager.init({ envKeys });

```
  
### Example with express.js 
Coming Soon  
