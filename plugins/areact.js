
import store from '../lib/lightweight_store.js';

const autoEmojis = [
    // Hearts
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
    '🤎', '💖', '💗', '💓', '💞', '💕', '💘', '💝',
    '💟', '❣️', '♥️', '❤️‍🔥',

    // Faces
    '😀', '😃', '😄', '😁', '😆', '😂', '🤣', '🥹',
    '😊', '😍', '🥰', '😘', '😎', '🤩', '🥳', '😇',
    '😉', '🤗', '🤭', '😜', '😻', '🙈', '💀', '😭',

    // Nature
    '🌸', '🌹', '🌺', '🌻', '🌼', '🌷', '🦋', '🍀',
    '🌈', '🌙', '☀️', '⭐', '🌟', '✨', '🌿', '🍁',

    // Reactions
    '👍', '👎', '👏', '🙌', '🙏', '👌', '🤝', '💪',
    '✌️', '🤟', '🫶', '🔥', '💯', '💥', '⚡', '🎉',
    '🎊', '🏆', '👑', '💎', '🚀', '🎁', '💐', '🎈',

    // Fun
    '🍫', '🍓', '🍒', '🐼', '🐱', '🐶', '🎵', '🎶'
];

let AUTO_REACT_MESSAGES = false;
let lastReactedTime = 0;

function randomEmoji() {
    return autoEmojis[
        Math.floor(Math.random() * autoEmojis.length)
    ];
}

function hasContent(message) {
    return Boolean(
        message.conversation ||
        message.extendedTextMessage ||
        message.imageMessage ||
        message.videoMessage ||
        message.documentMessage ||
        message.audioMessage ||
        message.stickerMessage ||
        message.contactMessage ||
        message.locationMessage
    );
}

// Load saved setting
store.getSetting('global', 'autoReaction')
    .then((setting) => {
        if (typeof setting?.enabled === 'boolean') {
            AUTO_REACT_MESSAGES = setting.enabled;
        }
    })
    .catch((error) => {
        console.error('[AutoReact] Setting load error:', error.message);
    });

export default {
    command: 'autoreact',
    aliases: ['areact'],
    category: 'owner',
    description: 'Toggle automatic message reactions',
    usage: '.autoreact on/off',
    ownerOnly: true,

    async handler(sock, message, args, context) {
        const { chatId, channelInfo } = context;
        const action = args[0]?.toLowerCase();

        if (!['on', 'off'].includes(action)) {
            await sock.sendMessage(chatId, {
                text: '*Usage:*\n.autoreact on/off',
                ...channelInfo
            }, { quoted: message });

            return;
        }

        AUTO_REACT_MESSAGES = action === 'on';

        await store.saveSetting('global', 'autoReaction', {
            enabled: AUTO_REACT_MESSAGES
        });

        await sock.sendMessage(chatId, {
            text: AUTO_REACT_MESSAGES
                ? '*✅ Auto React Enabled!*\nIncoming and outgoing messages are included.'
                : '*❌ Auto React Disabled!*',
            ...channelInfo
        }, { quoted: message });

        // Attach event listener only once
        if (sock.__autoReactAttached) return;

        sock.ev.on('messages.upsert', async ({ messages }) => {
            if (!AUTO_REACT_MESSAGES) return;

            for (const msg of messages || []) {
                try {
                    if (!msg?.message || !msg?.key?.remoteJid) continue;

                    const chat = msg.key.remoteJid;

                    // Ignore status and reaction events
                    if (chat === 'status@broadcast') continue;
                    if (msg.message.reactionMessage) continue;
                    if (!hasContent(msg.message)) continue;

                    // Do not skip fromMe: own messages are included
                    const now = Date.now();

                    if (now - lastReactedTime < 2000) continue;

                    await sock.sendMessage(chat, {
                        react: {
                            text: randomEmoji(),
                            key: msg.key
                        }
                    });

                    lastReactedTime = Date.now();

                } catch (error) {
                    console.error(
                        '[AutoReact] Error:',
                        error.message
                    );
                }
            }
        });

        sock.__autoReactAttached = true;
    }
};
