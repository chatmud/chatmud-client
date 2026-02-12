import Anser, { AnserJsonEntry } from "anser";
import YoutubeEmbed, { extractYoutubeVideoId } from "./components/YoutubeEmbed";

export function parseToElements(
    text: string,
    onExitClick: (exit: string) => void
): React.ReactElement[] {
    let elements: React.ReactElement[] = [];
    // handle multiline strings by splitting them and adding the appropriate <br/>
    for (const line of text.split("\r\n")) {
        const parsed = Anser.ansiToJson(line, { json: true, remove_empty: false });
        let children: React.ReactNode[] = [];
        for (const bundle of parsed) {
            const newElements = convertBundleIntoReact(bundle, onExitClick);
            children = [...children, ...newElements];
        }
        elements = [...elements, <span key={elements.length}>{children}</span>];
    }
    return elements;
}

const URL_REGEX =
    /(\s|^)((\w+):\/\/(?:www\.|(?!www))[^\s.]+\.[^\s]{2,}|www\.[^\s]+\.[^\s]{2,})/g;
const YOUTUBE_REGEX =
    /(\s|^)((?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|m\.youtube\.com\/watch\?v=)[a-zA-Z0-9_-]{11}(?:\S*)?)/g;
const EMAIL_REGEX =
    /(?<slorp1>\s|^)(?<name>[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+[a-zA-Z])(?<slorp2>\s|$|\.)/g;
const exitRegex = /@\[exit:([a-zA-Z]+)\]([a-zA-Z]+)@\[\/\]/g;

function convertBundleIntoReact(
    bundle: AnserJsonEntry,
    onExitClick: (exit: string) => void
): React.ReactElement[] {
    const style = createStyle(bundle);
    const content: React.ReactNode[] = [];
    let index = 0;
    let keyCounter = 0; // Initialize a counter for keys

    function processRegex(
        regex: RegExp,
        process: (match: RegExpExecArray) => React.ReactNode
    ): void {
        let match: RegExpExecArray | null;
        while ((match = regex.exec(bundle.content)) !== null) {
            const startIndex = match.index;
            if (startIndex > index) {
                content.push(bundle.content.substring(index, startIndex));
            }
            content.push(process(match));
            index = regex.lastIndex;
        }
    }

    function processYoutubeMatch(match: RegExpExecArray): React.ReactNode {
        const [, pre, url] = match;
        const videoId = extractYoutubeVideoId(url);

        if (videoId) {
            return (
                <>
                    {pre}
                    <YoutubeEmbed videoId={videoId} url={url} key={keyCounter++} />
                </>
            );
        }

        // Fallback to regular link if video ID extraction fails
        return (
            <>{pre}<a href={url} target="_blank" rel="noreferrer">
                {url}
            </a></>
        );
    }

    function processUrlMatch(match: RegExpExecArray): React.ReactNode {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const [, pre, url] = match;
        const href = url;
        return (
            <>{pre}<a href={href} target="_blank" rel="noreferrer">
                {url}
            </a></>
        );
    }

    function processEmailMatch(match: RegExpExecArray): React.ReactNode {
        const email = match.groups!["name"];
        const href = `mailto:${email}`;
        return (
            <>
                {match.groups!["slorp1"]}
                <a href={href} target="_blank" rel="noreferrer">
                    {email}
                </a>
                {match.groups!["slorp2"]}
            </>
        );
    }

    function processExitMatch(match: RegExpExecArray): React.ReactNode {
        const [, exitType, exitName] = match;
        return (
            // eslint-disable-next-line jsx-a11y/anchor-is-valid
            <a onClick={() => onExitClick(exitType)} className="exit">
                {exitName}
            </a>
        );
    }

    // Process YouTube URLs first, before generic URLs
    processRegex(YOUTUBE_REGEX, processYoutubeMatch);
    processRegex(URL_REGEX, processUrlMatch);
    processRegex(EMAIL_REGEX, processEmailMatch);
    processRegex(exitRegex, processExitMatch);

    if (index < bundle.content.length) {
        content.push(bundle.content.substring(index));
    }
    return content.map((c) => <span style={style} key={keyCounter++}>{c}</span>);
}

/**
 * Create the style attribute.
 * @name createStyle
 * @function
 * @param {AnserJsonEntry} bundle
 * @return {Object} returns the style object
 */
function createStyle(bundle: AnserJsonEntry): React.CSSProperties {
    const style: React.CSSProperties = {};
    if (bundle.bg) {
        style.backgroundColor = `rgb(${bundle.bg})`;
    }
    if (bundle.fg) {
        style.color = `rgb(${bundle.fg})`;
    }
    switch (bundle.decoration) {
        case "bold":
            style.fontWeight = "bold";
            break;
        case "dim":
            style.opacity = "0.5";
            break;
        case "italic":
            style.fontStyle = "italic";
            break;
        case "hidden":
            style.visibility = "hidden";
            break;
        case "strikethrough":
            style.textDecoration = "line-through";
            break;
        case "underline":
            style.textDecoration = "underline";
            break;
        case "blink":
            style.textDecoration = "blink";
            break;
        default:
            break;
    }
    return style;
}
