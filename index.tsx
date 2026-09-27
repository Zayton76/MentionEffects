import "./styles.css";

import definePlugin from "@utils/types";
import {
    GuildMemberStore,
    GuildRoleStore,
    ChannelStore,
} from "@webpack/common";

const STYLE_CLASS = "roleColorEffect";

/* =========================================================
   ROLE COLOR
========================================================= */

function getHighestRoleColor(
    guildId: string,
    userId: string
): string | null {
    const member = GuildMemberStore.getMember(
        guildId,
        userId
    );

    if (!member) return null;

    const roles =
        GuildRoleStore.getSortedRoles(guildId);

    const memberRoles = new Set(member.roles);

    for (const role of roles) {
        if (!memberRoles.has(role.id)) continue;
        if (!role.color || role.color === 0) continue;

        return `#${role.color
            .toString(16)
            .padStart(6, "0")}`;
    }

    return null;
}

/* =========================================================
   APPLY COLOR
========================================================= */

function applyColor(
    element: Element,
    userId: string,
    guildId: string
) {
    const color = getHighestRoleColor(
        guildId,
        userId
    );

    if (!color) return;

    const html = element as HTMLElement;

    html.style.setProperty(
        "--role-color",
        color
    );

    html.classList.add(STYLE_CLASS);
}

/* =========================================================
   REACT FIBER
========================================================= */

function getFiber(element: Element) {
    const key = Object.keys(element).find(
        key =>
            key.startsWith("__reactFiber")
    );

    return key
        ? (element as any)[key]
        : null;
}

/* =========================================================
   MENTION INFO
========================================================= */

function getMentionInfo(element: Element) {
    let fiber = getFiber(element);

    for (
        let i = 0;
        i < 20 && fiber;
        i++
    ) {
        const props =
            fiber.memoizedProps;

        if (props?.user?.id) {
            return {
                userId: props.user.id,
                guildId:
                    props.guildId ?? null,
            };
        }

        fiber = fiber.return;
    }

    return null;
}

/* =========================================================
   MENTIONS
========================================================= */

function processMentions() {
    document
        .querySelectorAll(
            ".mention.wrapper_f61d60"
        )
        .forEach(mention => {

            const info =
                getMentionInfo(mention);

            if (
                !info?.userId ||
                !info.guildId
            ) {
                return;
            }

            applyColor(
                mention,
                info.userId,
                info.guildId
            );
        });
}

/* =========================================================
   MESSAGE CHANNEL
========================================================= */

function getMessageChannelId(
    messageElement: Element
) {
    const id =
        messageElement.getAttribute("id");

    if (!id) return null;

    const match = id.match(
        /^chat-messages-(\d+)-(\d+)$/
    );

    return match?.[1] ?? null;
}

/* =========================================================
   REPLY PREVIEW
========================================================= */

function processReplyPreview(
    messageElement: Element,
    guildId: string
) {
    const replies =
        messageElement.querySelectorAll(
            ".repliedMessage_c19a55"
        );

    replies.forEach(reply => {

        /*
         * The username in the reply preview
         * is the ORIGINAL message author.
         */

        const username =
            reply.querySelector(
                ".username_c19a55"
            );

        if (!username) return;

        /*
         * The username element has a React
         * fiber containing the actual user.
         */

        const userId =
            getUserIdFromFiber(username);

        if (!userId) return;

        /*
         * Only color the actual replied text,
         * not the entire reply container.
         */

        const repliedText =
            reply.querySelector(
                ".repliedTextContent_c19a55"
            );

        if (!repliedText) return;

        applyColor(
            repliedText,
            userId,
            guildId
        );
    });
}

/* =========================================================
   GET USER FROM REACT
========================================================= */

function getUserIdFromFiber(
    element: Element
): string | null {

    let fiber = getFiber(element);

    for (
        let i = 0;
        i < 20 && fiber;
        i++
    ) {
        const props =
            fiber.memoizedProps;

        if (props?.user?.id) {
            return props.user.id;
        }

        fiber = fiber.return;
    }

    return null;
}

/* =========================================================
   NORMAL MESSAGES
========================================================= */

function processMessages() {

    document
        .querySelectorAll(
            "li[data-author-id]"
        )
        .forEach(messageElement => {

            const userId =
                messageElement.getAttribute(
                    "data-author-id"
                );

            if (!userId) return;

            const channelId =
                getMessageChannelId(
                    messageElement
                );

            if (!channelId) return;

            const channel =
                ChannelStore.getChannel(
                    channelId
                );

            if (!channel?.guild_id)
                return;

            const guildId =
                channel.guild_id;

            /*
             * FIRST:
             * Color the reply preview using
             * the ORIGINAL author's color.
             */

            processReplyPreview(
                messageElement,
                guildId
            );

            /*
             * THEN:
             * Color the actual message content.
             */

            const contents =
                messageElement.querySelectorAll(
                    ".messageContent_c19a55"
                );

            contents.forEach(content => {

                /*
                 * Do NOT color the replied
                 * message preview as the
                 * current author's message.
                 */

                if (
                    content.closest(
                        ".repliedMessage_c19a55"
                    )
                ) {
                    return;
                }

                applyColor(
                    content,
                    userId,
                    guildId
                );
            });
        });
}

/* =========================================================
   PROCESS EVERYTHING
========================================================= */

function processEverything() {
    processMessages();
    processMentions();
}

/* =========================================================
   OBSERVER
========================================================= */

let observer:
    MutationObserver | null = null;

/* =========================================================
   PLUGIN
========================================================= */

export default definePlugin({

    name: "MentionEffects",

    description:
        "Automatically colors Discord messages, mentions and reply previews using role colors.",

    authors: [{
        name: "Zayton",
        id: 718875439459991606n,
    }],

    start() {

        processEverything();

        observer =
            new MutationObserver(() => {
                processEverything();
            });

        observer.observe(
            document.body,
            {
                childList: true,
                subtree: true,
            }
        );
    },

    stop() {

        observer?.disconnect();

        observer = null;

        document
            .querySelectorAll(
                `.${STYLE_CLASS}`
            )
            .forEach(element => {

                element.classList.remove(
                    STYLE_CLASS
                );

                (
                    element as HTMLElement
                ).style.removeProperty(
                    "--role-color"
                );
            });
    },
});