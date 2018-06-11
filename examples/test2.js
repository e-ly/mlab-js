


let mLab = require('../index.js')

let myLab = new mLab({ name: '', password: '' })

myLab.Connect().then(async () => {
    try {
         
        // Attempt logging out ..
        await myLab.Logout()

        // Attempt logging back in ..
        await myLab.Login()

        // Default tests but more simplistic than in V1
        let db = await myLab.DeployDatabase({ name: 'testDatabase', 
            region: 'us-east-1',
            ignore: true
        })
        await db.AddUser({ name: 'testAdmin0', password: 'securePw0' })
        await db.RemoveUser('testAdmin0')
        
        // Clean up
        await db.Delete()
        console.log('Completed test V2')
    
    } catch(e) {
         console.log(e.stack) 
    }

})
