const { SMTPServer } = require('smtp-server');

const server = new SMTPServer({
    secure: false,

    // Aucun mot de passe / aucune authentification
    authOptional: true,

    // Autorise les connexions locales
    disabledCommands: ['AUTH', 'STARTTLS'],

    onConnect(session, callback) {
        console.log('=================================');
        console.log('Nouvelle connexion SMTP');
        console.log('IP :', session.remoteAddress);
        console.log('=================================');

        callback();
    },

    onMailFrom(address, session, callback) {
        console.log('Expéditeur :', address.address);
        callback();
    },

    onRcptTo(address, session, callback) {
        console.log('Destinataire :', address.address);
        callback();
    },

    onData(stream, session, callback) {
        let email = '';

        stream.on('data', chunk => {
            email += chunk.toString();
        });

        stream.on('end', () => {
            console.log('');
            console.log('=================================');
            console.log('EMAIL REÇU');
            console.log('=================================');
            console.log(email);
            console.log('=================================');
            console.log('');

            callback();
        });
    },

    onError(error) {
        console.error('Erreur SMTP :', error.message);
    }
});

server.listen(1025, '127.0.0.1', () => {
    console.log('=================================');
    console.log('SERVEUR SMTP NODE.JS');
    console.log('=================================');
    console.log('Adresse : 127.0.0.1');
    console.log('Port    : 1025');
    console.log('Auth    : désactivée');
    console.log('TLS     : désactivé');
    console.log('=================================');
});