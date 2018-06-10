


let mLab = require('./index.js')

function Sleep(seconds) {
    // JavaScript's best equivalent to Lua's Wait()
    return new Promise(resolve => setTimeout(resolve, 1000 * seconds))
}

let myLab = new mLab({
    name: 'akyuma',
    password: 'Herking530'
})

myLab.Connect().then(() => {

    console.log('Connected to lab!')

    myLab.DeployDatabase({
        name: 'TestDatabase', region: 'us-east-1'
    }).then(mbase => {

        console.log('Deployed database!')

        let template = mbase.Meta.uriTemplate
        console.log('Database template = ' + template)
        console.log('Database uri = ' + mbase.Meta.uriAddress)

        mbase.AddUser({
            name: 'ExampleUser',
            password: 'examplePass0'
        }).then(() => {
            let final = template.replace('{username}', 'ExampleUser').replace('{password}', 'examplePw0')
            console.log('Database uri w/ user = ' + final)
            Sleep(5).then(() => {
                mbase.Delete().then(() => {
                    console.log('Test concluded, all cleaned up!')
                })
            })
        })

    })
})
