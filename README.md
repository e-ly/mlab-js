# mlab.js

Uses mLab's hidden API (probably for good reason) to strictly deploy & remove databases along with adding and removing users to them.

By using this package, you agree that I am not liable for whatever happens to you and your account, in any way shape or form. Read mLab's [acceptable use policy](https://mlab.com/company/legal/aup/) and their [terms of service](https://mlab.com/company/legal/tos/)

## example of use
```js
// refer to test.js for a more in-depth example
const mLab = require('mlab.js')

let lab = new mLab({ name: 'name', password: 'pass' })
lab.Connect().then(async () => {
    let db = await lab.DeployDatabase({ name: 'example', region: 'us-east-1' })
    console.log('URL = ' + db.Meta.uriTemplate)
})
```

## available options
```js
{
    
    name: 'string',
    // the username of the account

    password: 'string',
    // the password of the account

    Id: null,
    // the id of the account, must be a string
    // if not provided, will be automatically retrieved when connected

    waitEnabled: false,
    // if true, then it will ensure to wait until the db is loaded
    
    waitInterval: 30,
    // the wait interval used when waiting for db to be loaded

    refreshInterval: 60000 * 30
    // the refresh interval for retrieving the csrf token

}
```

## deploying a database
```js
{

    name: 'string',
    // the name of the database

    region: 'string',
    // the region of the database to be located in
    // ex. us-east-1

    ignore: false,
    // if true, it will not throw an error if the db already exists.

    // everything below will default to sandbox options
    // no documentation will be given.

    provider: 'AWS',
    
    version: '3.4.15',

    plan: 'aws-sandbox-v2'

}
```

## adding a user
```js
{
    
    // self explanatory
    name: 'string',
    password: 'string',

    ignore: false,
    // if true, will not throw an error if the user already exists

}
```


