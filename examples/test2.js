


let mLab = require('../index.js')

let myLab = new mLab({ name: '', password: '' })

(async () => {
    try {
        await myLab.Connect()
        await myLab.__Authenticate()
        await myLab.__UpdateCSRFToken()
        let db = await myLab.DeployDatabase({
            name: 'testDatabase', 
            region: 'us-east-1',
            ignore: true
        })
        await db.AddUser({
            name: 'testAdmin0', 
            password: 'securePw0'
        })
        await db.RemoveUser('testAdmin0')
    } catch(e) {
         console.log(e.stack) 
    }
})()
