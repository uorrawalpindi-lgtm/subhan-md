
import store from '../lib/lightweight_store.js';

const autoEmojis = [
    '💘', '💝', '💖', '💗', '💓', '💞', '💕', '💟',
    '❣️', '❤️', '🧡', '💛', '💚', '💙', '💜', '🤎',
    '🖤', '🤍', '♥️', '❤️‍🔥',
    '🎈', '🎁', '💌', '💐', '😘', '🤗',
    '🌸', '🌹', '🥀', '🌺', '🌼', '🌷', '🌻',
    '🍁', '🍀', '🌿', '🌴', '🌈', '🌙', '☀️',
    '⭐', '🌟', '😊', '🥰', '😍', '🤩', '☺️',
    '😂', '🤣', '😎', '🥳', '😇', '😉', '😜',
    '🤭', '🫶', '🥹', '😻', '🙈', '💀', '😭',
    '👍', '👎', '👏', '🙌', '🙏', '👌', '🤝',
    '💪', '✌️', '🤟', '🔥', '💯', '✨', '⚡',
    '💥', '🎉', '🎊', '🏆', '🍫', '🍓', '🍒',
    '🦋', '🐼', '🐱', '🐶', '👑', '💎', '🚀',
    '🎵', '🎶'
];

let AUTO_REACT_MESSAGES = false;

store.getSetting('global', 'autoReaction')
    .then((v) => {
        if (v?.enabled !== undefined) {
            AUTO_REACT_MESSAGES = v.enabled;
        }
    })
    .catch(() => {});

let lastReactedTime = 0;

function random(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

export default {
    command: 'autoreact',
    aliases: ['areact'],
    category: 'owner',
    description: 'Toggle auto-react to messages',
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
                ? '*✅ Auto-react enabled*'
                : '*❌ Auto-react disabled*',
            ...channelInfo
        }, { quoted: message });

        if (sock.__autoReactAttached) return;

        sock.ev.on('messages.upsert', async ({ messages }) => {
            if (!AUTO_REACT_MESSAGES) return;

            for (const m of messages) {
                if (!m?.message || !m?.key?.remoteJid) continue;
                if (m.key.remoteJid === 'status@broadcast') continue;
                if (m.message.reactionMessage) continue;

                const text = m.message.conversation ||
                    m.message.extendedTextMessage?.text || '';

                if (!text) continue;
                if (/^[!#.$%^&*+=?<>]/.test(text)) continue;

                const now = Date.now();
                if (now - lastReactedTime < 2000) continue;

                try {
                    await sock.sendMessage(m.key.remoteJid, {
                        react: {
                            text: random(autoEmojis),
                            key: m.key
                        }
                    });

                    lastReactedTime = Date.now();
                } catch (error) {
                    console.error('[AutoReact] Error:', error.message);
                }
            }
        });

        sock.__autoReactAttached = true;
    }
};
