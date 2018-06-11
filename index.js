


const Request = require('request-promise')

function Sleep(seconds) {
    // JavaScript's best equivalent to Lua's Wait()
    return new Promise(resolve => setTimeout(resolve, 1000 * seconds))
}

function HandleErr(errRes, preMsg) {
    // I'm lazy lol ..
    let statusCode = errRes.statusCode
    throw new Error(`Error ${statusCode}: ${preMsg}`)
}

module.exports = class mLab {

    constructor(opts) {

        // If name or password isn't supplied, throw excp.
        if (!opts.name || !opts.password) {
            throw new Error('Insufficient credentials provided.')
        }

        // Initialize public `Databases` and `Credentials`
        this.Databases = {}
        this.Credentials = { name: opts.name, password: opts.password }
        
        // This should remain private and be only accessible through
        // the internal functions of this class.
        this.Internal = {
            cookieJar: Request.jar(),
            Refresher: null,
            isAuthenticated: false,
            csrfToken: null,
            Id: opts.Id || null,
            waitEnabled: opts.waitEnabled || false,
            waitInterval: opts.waitInterval || 30,
            refreshInterval: opts.refreshInterval || 18000000
        }

    }

    async Connect() {

        if (!this.Internal.isAuthenticated) await this.Login()
        
        this.Internal.Refresher = setInterval(async () => {
            await this.Login()
        }, this.Internal.refreshInterval)

        return true 

    }

    HasDatabase(name) {
        return this.Databases[name] 
    }

    async DeployDatabase(opts) {

        // Start of PRE
        // Determine the important variables
        let name = opts.name,
            region = opts.region
        // If they don't exist, lets throw an exception
        if (!name || !region) throw new Error('Insufficient parameters.')
        // Lets check if the database already exists!
        let mbase = await this.HasDatabase(name)
        if (mbase) {
            if (opts.ignore) return mbase
            else throw new Error(`Database "${name}" already exists.`)
        }
        // End of PRE
        
        let thisJar = this.Internal.cookieJar,
            csrf = this.Internal.csrfToken,
            id = this.Internal.Id,
            URL = `https://mlab.com/mlab-api/accounts/${id}/deployments`

        let res = await Request(URL, {
            method: 'POST', jar: thisJar, json: true,
            body: {
                dbName: name,
                region: region,
                plan: opts.plan || 'aws-sandbox-v2',
                provider: opts.provider || 'AWS',
                mongodbVersion: opts.version || '3.4.15'
            }, 
            headers: {
                'CSRF_TOKEN': csrf, 
                'X-REQUESTED-WITH': ''
            } 
        })
        .catch(errRes => HandleErr(errRes, 'Failed to deploy database.'))
        
        if (this.Internal.waitEnabled) {
            console.log(`Waiting for db ${name} to be deployed ..`)
            let dbIsDeployed = false
            while (!dbIsDeployed) {
                let status = await this.GetDatabaseStatus(name)
                if (status.loggedState == 'provisoned') dbIsDeployed = true
                else await Sleep(this.Internal.waitInterval) // for thirty seconds
            }
        }
        
        return new mBase(this, res)

    }

    async GetDatabaseStatus(name) {
        
        let thisJar = this.Internal.cookieJar,
            csrf = this.Internal.csrfToken,
            URL = `https://mlab.com/portal-api/databases/${name}/status`

        let status = await Request(URL, {
            jar: thisJar, 
            headers: {
                'CSRF_TOKEN': csrf, 
                'X-REQUESTED-WITH': ''
            }
        })
        .catch(errRes => HandleErr(errRes, 'Failed to get status.'))

        return status

    }

    async RemoveDatabase(name) {

        if (!this.HasDatabase(name)) {
            throw new Error(`Database "${name}" does not exist.`)
        }

        let thisJar = this.Internal.cookieJar,
            csrf = this.Internal.csrfToken,
            URL = `https://mlab.com/delete?CSRF_TOKEN=${csrf}`

        await Request(URL, {
            method: 'POST', jar: thisJar,
            form: { db: name },

            maxRedirects: 1,
            followAllRedirects: true, 
            followRedirect: (r) => r.headers.location == '/home'

        })
        .catch(errRes => HandleErr(errRes, 'Failed to remove database.'))

        delete this.Databases[name]

        return true 

    }

    // Internal functions listed below, little documentation
    // provided for these methods.

    async Logout() {
        
        let thisJar = this.Internal.cookieJar,
            csrf = this.Internal.csrfToken,
            URL = `https://mlab.com/logout?=${csrf}`
        
        await Request(URL, {
            method: 'POST', jar: thisJar,
            form: { CSRF_TOKEN: csrf },
            followAllRedirects: true,
            followRedirect: (r) => r.headers.location == '/login/'
        })
        .then(() => this.Internal.cookieJar = Request.jar())
        .catch(errRes => HandleErr(errRes, 'Failed to sign out.'))
        
        this.Internal.isAuthenticated = false
        this.Internal.csrfToken = null
        this.Internal.Id = null

        for (let key in this.Databases) delete this.Databases[key]
        this.Databases = {}
        
        return true

    }

    async Login() {
        
        await this.__Authenticate()
        await this.__UpdateCSRFToken()

        if (!this.Internal.Id) {
            await this.__GetAccountId()
            await this.__LoadDatabases()
        }

        return true

    }

    async __Authenticate() {

        if (this.Internal.isAuthenticated) {
            
            // await this.Logout()
            // OR 
            this.Internal.cookieJar = Request.jar()
            this.Internal.isAuthenticated = false
            this.Internal.csrfToken = null

        }

        let thisJar = this.Internal.cookieJar,
            URL = 'https://mlab.com/dologin?r=',
            name = this.Credentials.name,
            password = this.Credentials.password

        await Request(URL, {
            method: 'POST', jar: thisJar,
            form: { username: name, password: password }
        })
        .catch(errRes => {

            let statusCode = errRes.statusCode

            // User probably didn't provide enough credentials.
            if (statusCode == 404) {
                if (this.Internal.isAuthenticated) {
                    // Username or password must've been changed
                    // to an invalid combination.
                    this.Internal.isAuthenticated = false
                }
                throw new Error('Invalid credentials provided.')
            } else HandleErr(errRes, 'Failed to authenticate.')

        })

        this.Internal.isAuthenticated = true
        return true

    }

    async __UpdateCSRFToken() {
        
        // Before anything, ensure that the user is authenticated.
        if (!this.Internal.isAuthenticated) await this.__Authenticate()

        // Now we can continue the procedure
        let thisJar = this.Internal.cookieJar,
            URL = 'https://mlab.com/csrf.js'

        // POSTing to this URL is the easiest way to get the CSRF token.
        let resBody = await Request(URL, {
            method: 'POST', jar: thisJar,
            headers: { 'FETCH-CSRF-TOKEN': 1 }
        }).catch(errRes => HandleErr(errRes, 'Failed to get csrf token.'))

        // It's in the body and can be easily fetched liked so:
        let csrfToken = resBody.split(':')[1]
        this.Internal.csrfToken = csrfToken

        return csrfToken

    }

    async __GetAccountId() {

        // Much thanks to Martini for this method!
        // His creativeness was the reason why we can do this.
        
        // Before anything (again), ensure that the user is authenticated.
        if (!this.Internal.isAuthenticated) await this.__Authenticate()
        if (this.Internal.Id) return this.Internal.Id 
        
        let thisJar = this.Internal.cookieJar,
            URL = 'https://mlab.com/create/wizard'

        let htmlBody = await Request(URL, { jar: thisJar })
        .catch(errRes => HandleErr(errRes, 'Failed to get account id.'))
        
        // We want to catch any exceptions
        let accountId;
        try {
            accountId = htmlBody.match(/accountId: "(.*?)",/)[1]
        } catch (e) {
            throw new Error('Failed to retrieve account Id from htmlBody.')
        }
     
        this.Internal.Id = accountId
        
        return accountId

    }

    async __LoadDatabases() {

        let thisJar = this.Internal.cookieJar,
            id = this.Internal.Id,
            databases = this.Databases,
            URL = `https://mlab.com/mlab-api/accounts/${id}/deployments`


        let res = await Request(URL, { jar: thisJar, json: true })
        .catch(errRes => HandleErr(errRes, 'Failed to get databases.'))

        for (let name in res) new mBase(this, res[name])

        return true

    }

}

class mBase {

    constructor(mlab, meta) {
    
        let ci = meta.connectionInfo

        this.name = meta.name
        this.Id = meta._id
        this.Meta = {
            
            provider: meta.provider,
            region: meta.region,
            planType: meta.planType,
            version: meta.mongodbVersion,
            display: meta.mlabDisplayLabel,

            uriTemplate: ci.uriTemplate,
            uriAddress: `mongodb://${ci.uriComponents.serverAddresses[0]}`

        }
        
        this.Lab = mlab
        this.Users = {}
        mlab.Databases[meta.name] = this

    }

    get jar() { return this.Lab.Internal.cookieJar }
    get csrf() { return this.Lab.Internal.csrfToken }

    async HasUser(name) {
        
        if (this.Users[name]) return true 

        let thisJar = this.jar,
            URL = `https://mlab.com/portal-api/databases/${this.name}/users?mode=raw`

        let resBody = await Request(URL, { jar: thisJar, json: true })
        .catch(errRes => HandleErr(errRes, 'Failed to fetch all users.'))
        
        for (let i = 0; i < resBody.length; i ++) {
            if (resBody[i].user == name) return true
            else this.Users[resBody[i].user] = true
        }

        return false

    }

    async AddUser(opts) {
        
        if (await this.HasUser(opts.name)) {
            if (!opts.ignore) throw new Error(`User "${opts.name}" already exists.`)
            else return true
        }

        let thisJar = this.jar,
            csrf = this.csrf,
            URL = `https://mlab.com/adddbuser?CSRF_TOKEN=${csrf}`

        let loc = `/databases/${this.name}#users`
        await Request(URL, {
            method: 'POST', jar: thisJar, 
            form: {
                db: this.name, 
                tab: '#users',
    
                username: opts.name,
                password: opts.password,
                password2: opts.password,
                readOnly: opts.readOnly ? 'readOnly' : null
            },

            maxRedirects: 1,
            followAllRedirects: true,
            followRedirect: (r) => r.headers.location == loc

        })
        .catch(errRes => HandleErr(errRes, 'Failed to add user.'))
        
        if (!await this.HasUser(opts.name)) {
            throw new Error('Failed to add user, malformed request.')
        } else this.Users[opts.name] = opts.password

        return true 

    }

    async RemoveUser(name) {
        
        if (!await this.HasUser(name)) {
            throw new Error(`User "${name}" does not exist.`)
        }

        let thisJar = this.jar,
            csrf = this.csrf,
            URL = `https://mlab.com/deletedbuser?CSRF_TOKEN=${csrf}`

        let loc = `/databases/${this.name}#users`
        await Request(URL, {
            method: 'POST', jar: thisJar, 
            form: {
                db: this.name, 
                tab: '#users',
                
                username: name
            },

            maxRedirects: 1,
            followAllRedirects: true,
            followRedirect: (r) => r.headers.location == loc

        })
        .catch(errRes => HandleErr(errRes, 'Failed to delete user.'))
        
        let lastValue = this.Users[name]
        delete this.Users[name]
        if (await this.HasUser(name)) {
            this.Users[name] = lastValue
            throw new Error('Failed to remove user.')
        }

        return true 

    }

    Delete() {
        return this.Lab.RemoveDatabase(this.name)
    }

}



