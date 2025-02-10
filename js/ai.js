"use strict";
import theme from "./theme.js";
import { sourceEditor } from "./ide.js";

// Configuration
const CHAT_CONFIG = {
    maxMessages: 100,
    loadingIndicatorDelay: 300,
    animationDuration: 200
};

const THREAD = [
    {
        role: "system",
        content: `
You are an AI assistant integrated into an online code editor.
Your main job is to help users with their code, but you should also be able to engage in casual conversation.

The following are your guidelines:
1. **If the user asks for coding help**:
   - Always consider the user's provided code.
   - Analyze the code and provide relevant help (debugging, optimization, explanation, etc.).
   - Make sure to be specific and clear when explaining things about their code.
   - When providing code examples, wrap them in \`\`\`language code\`\`\` blocks.
   - Always specify which part of the code you're modifying by mentioning line numbers or function names.
   - Always specify the language when providing code blocks.

2. **If the user asks for code generation**:
   - Generate complete, working code examples.
   - Always include comments explaining key parts of the code.
   - Ensure the code follows best practices.
   - Make the code easily insertable into their editor.
   - Clearly indicate if this is a full replacement or a partial code update.

3. **General Behavior**:
   - Always respond in a helpful, friendly, and professional tone.
   - Keep responses concise but informative.
   - If unsure about which part of code to modify, ask for clarification.
`.trim()
    }
];

// Add a state variable to track selected code
let currentSelection = null;

// UI Components
class ChatUI {
    static createMessageElement(content, isUser = false) {
        const message = document.createElement("div");
        message.classList.add(
            "chat-message",
            isUser ? "user-message" : "ai-message",
            "animate-fade-in"
        );
        
        const avatar = document.createElement("div");
        avatar.classList.add("message-avatar");
        avatar.innerHTML = isUser ? '<i class="user circle icon"></i>' : '<i class="computer icon"></i>';
        
        const bubble = document.createElement("div");
        bubble.classList.add("message-bubble");
        
        if (typeof content === "string") {
            bubble.textContent = content;
        } else {
            bubble.appendChild(content);
        }
        
        message.appendChild(avatar);
        message.appendChild(bubble);
        
        return message;
    }

    static createLoadingIndicator() {
        const loading = document.createElement("div");
        loading.classList.add("chat-loading");
        loading.innerHTML = `
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        return loading;
    }

    static createCodeBlock(codeBlock) {
        const container = document.createElement("div");
        container.classList.add("code-block");
        
        const header = document.createElement("div");
        header.classList.add("code-header");
        
        const langBadge = document.createElement("span");
        langBadge.classList.add("lang-badge");
        langBadge.textContent = codeBlock.language;
        
        const actions = document.createElement("div");
        actions.classList.add("code-actions");
        
        const copyBtn = document.createElement("button");
        copyBtn.innerHTML = '<i class="copy icon"></i>';
        copyBtn.onclick = () => ChatUI.handleCodeCopy(codeBlock.code, copyBtn);
        
        const insertBtn = document.createElement("button");
        insertBtn.innerHTML = '<i class="code icon"></i>';
        insertBtn.onclick = () => ChatUI.handleCodeInsert(codeBlock.code);
        
        actions.appendChild(copyBtn);
        actions.appendChild(insertBtn);
        header.appendChild(langBadge);
        header.appendChild(actions);
        
        const pre = document.createElement("pre");
        const code = document.createElement("code");
        code.className = `language-${codeBlock.language}`;
        code.textContent = codeBlock.code;
        pre.appendChild(code);
        
        container.appendChild(header);
        container.appendChild(pre);
        
        // Apply Prism.js syntax highlighting
        if (window.Prism) {
            Prism.highlightElement(code);
        }
        
        return container;
    }

    static handleCodeCopy(code, button) {
        navigator.clipboard.writeText(code);
        const originalHtml = button.innerHTML;
        button.innerHTML = '<i class="check icon"></i>';
        setTimeout(() => {
            button.innerHTML = originalHtml;
        }, 2000);
    }

    static handleCodeInsert(code) {
        // Get the current selection or full document range
        const selection = sourceEditor.getSelection();
        const model = sourceEditor.getModel();
        
        let range;
        
        // If there's a stored selection from the original query, use that
        if (currentSelection) {
            range = currentSelection;
            currentSelection = null; // Clear the stored selection after use
        }
        // Else if there's a current selection, use that
        else if (!selection.isEmpty()) {
            range = selection;
        }
        // Otherwise use the full document
        else {
            range = {
                startLineNumber: 1,
                startColumn: 1,
                endLineNumber: model.getLineCount(),
                endColumn: model.getLineMaxColumn(model.getLineCount())
            };
        }

        // Replace the code in the determined range
        sourceEditor.executeEdits('insert-code', [{
            range: range,
            text: code,
            forceMoveMarkers: true
        }]);

        // Format the document if possible
        sourceEditor.getAction('editor.action.formatDocument')?.run();
        
        // Focus back on editor
        sourceEditor.focus();
    }
}



// Add styles to document
const styles = `
    .chat-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: ${theme.isLight() ? '#ffffff' : '#1e1e1e'};
    }
    
    .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 1rem;
        gap: 1rem;
        display: flex;
        flex-direction: column;
    }
    
    .chat-message {
        display: flex;
        gap: 0.5rem;
        opacity: 0;
        transform: translateY(10px);
        animation: fadeIn 0.3s ease forwards;
    }
    
    .message-avatar {
        width: 2rem;
        height: 2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: ${theme.isLight() ? '#f0f0f0' : '#2d2d2d'};
    }
    
    .message-bubble {
        max-width: 80%;
        padding: 0.75rem 1rem;
        border-radius: 1rem;
        background: ${theme.isLight() ? '#f0f0f0' : '#363636'};
        color: ${theme.isLight() ? '#000000' : '#ffffff'};
    }
    
    .user-message .message-bubble {
        background: #0066cc;
        color: white;
    }
    
    .code-block {
        margin: 0.5rem 0;
        border-radius: 0.5rem;
        overflow: hidden;
        border: 1px solid ${theme.isLight() ? '#e0e0e0' : '#333'};
        background: ${theme.isLight() ? '#f8f8f8' : '#1e1e1e'};
    }
    
    .code-block pre {
        margin: 0;
        padding: 1rem;
        overflow-x: auto;
    }
    
    .code-block code {
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        font-size: 0.9rem;
        line-height: 1.4;
    }

    /* Syntax highlighting colors for dark theme */
    .code-block .token.comment,
    .code-block .token.prolog,
    .code-block .token.doctype,
    .code-block .token.cdata {
        color: #6a9955;
    }

    .code-block .token.punctuation {
        color: #d4d4d4;
    }

    .code-block .token.property,
    .code-block .token.tag,
    .code-block .token.boolean,
    .code-block .token.number,
    .code-block .token.constant,
    .code-block .token.symbol,
    .code-block .token.deleted {
        color: #b5cea8;
    }

    .code-block .token.selector,
    .code-block .token.attr-name,
    .code-block .token.string,
    .code-block .token.char,
    .code-block .token.builtin,
    .code-block .token.inserted {
        color: #ce9178;
    }

    .code-block .token.operator,
    .code-block .token.entity,
    .code-block .token.url,
    .code-block .language-css .token.string,
    .code-block .style .token.string {
        color: #d4d4d4;
    }

    .code-block .token.atrule,
    .code-block .token.attr-value,
    .code-block .token.keyword {
        color: #569cd6;
    }

    .code-block .token.function,
    .code-block .token.class-name {
        color: #dcdcaa;
    }

    .code-block .token.regex,
    .code-block .token.important,
    .code-block .token.variable {
        color: #9cdcfe;
    }
    
    .code-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem;
        background: ${theme.isLight() ? '#f5f5f5' : '#2d2d2d'};
        border-bottom: 1px solid ${theme.isLight() ? '#e0e0e0' : '#333'};
    }
    
    .lang-badge {
        font-family: monospace;
        font-size: 0.8rem;
        color: ${theme.isLight() ? '#666' : '#aaa'};
    }
    
    .code-actions {
        display: flex;
        gap: 0.5rem;
    }
    
    .code-actions button {
        padding: 0.25rem 0.5rem;
        border: none;
        background: none;
        cursor: pointer;
        color: ${theme.isLight() ? '#666' : '#aaa'};
        transition: color 0.2s;
    }
    
    .code-actions button:hover {
        color: ${theme.isLight() ? '#000' : '#fff'};
    }
    
    .chat-input {
        padding: 1rem;
        border-top: 1px solid ${theme.isLight() ? '#e0e0e0' : '#333'};
    }
    
    .chat-input form {
        display: flex;
        gap: 0.5rem;
    }
    
    .chat-input input {
        flex: 1;
        padding: 0.75rem 1rem;
        border: 1px solid ${theme.isLight() ? '#e0e0e0' : '#333'};
        border-radius: 1.5rem;
        background: ${theme.isLight() ? '#fff' : '#2d2d2d'};
        color: ${theme.isLight() ? '#000' : '#fff'};
    }
    
    .chat-input button {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 1.5rem;
        background: #0066cc;
        color: white;
        cursor: pointer;
        transition: background 0.2s;
    }
    
    .chat-input button:hover {
        background: #0052a3;
    }
    
    .chat-input button:disabled {
        background: #ccc;
        cursor: not-allowed;
    }
    
    .typing-indicator {
        display: flex;
        gap: 0.3rem;
        padding: 0.5rem 1rem;
    }
    
    .typing-indicator span {
        width: 0.5rem;
        height: 0.5rem;
        border-radius: 50%;
        background: #0066cc;
        animation: bounce 1s infinite;
    }
    
    .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
    .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
    
    @keyframes fadeIn {
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    @keyframes bounce {
        0%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-0.5rem); }
    }
`;

// Initialize chat interface
document.addEventListener("DOMContentLoaded", function () {
    // Add styles
    const styleSheet = document.createElement("style");
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);

    // Update chat container structure
    const chatContainer = document.getElementById("judge0-chat-container");
    chatContainer.className = "chat-container";
    
    const messages = document.getElementById("judge0-chat-messages");
    messages.className = "chat-messages";
    
    const inputContainer = document.createElement("div");
    inputContainer.className = "chat-input";
    
    const form = document.getElementById("judge0-chat-form");
    inputContainer.appendChild(form);
    chatContainer.appendChild(inputContainer);

    // Handle form submission
    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        
        const userInput = document.getElementById("judge0-chat-user-input");
        const userInputValue = userInput.value.trim();
        if (!userInputValue) return;
        
        // Store current selection if any
        const selection = sourceEditor.getSelection();
        if (!selection.isEmpty()) {
            currentSelection = selection;
        }
        
        userInput.value = "";
        userInput.disabled = true;
        
        // Add user message
        const userMessage = ChatUI.createMessageElement(userInputValue, true);
        messages.appendChild(userMessage);
        messages.scrollTop = messages.scrollHeight;
        
        // Add loading indicator
        const loadingIndicator = ChatUI.createLoadingIndicator();
        messages.appendChild(loadingIndicator);
        messages.scrollTop = messages.scrollHeight;
        
        try {
            // Get selected code or full document
            let selection = sourceEditor.getSelection();
            let contextMessage = "";
            
            if (!selection.isEmpty()) {
                const selectedCode = sourceEditor.getModel().getValueInRange(selection);
                contextMessage = `
        Selected code (lines ${selection.startLineNumber}-${selection.endLineNumber}):
        \`\`\`
        ${selectedCode}
        \`\`\`
        
        Full code context:
        \`\`\`
        ${sourceEditor.getValue()}
        \`\`\`
        `;
            } else {
                contextMessage = `
        Current code:
        \`\`\`
        ${sourceEditor.getValue()}
        \`\`\`
        `;
            }
        
            THREAD.push({
                role: "user",
                content: `${contextMessage}
        
        User's message:
        ${userInputValue}`.trim()
            });

            const aiResponse = await puter.ai.chat(THREAD, {
                model: document.getElementById("judge0-chat-model-select").value,
            });
            
            let aiResponseValue = aiResponse.toString();
            if (typeof aiResponseValue !== "string") {
                aiResponseValue = aiResponseValue.map(v => v.text).join("\n");
            }

            THREAD.push({
                role: "assistant",
                content: aiResponseValue
            });

            // Process the response
            const codeBlocks = Array.from(aiResponseValue.matchAll(/```(\w+)?\n([\s\S]*?)```/g))
                .map(match => ({
                    language: match[1] || 'plaintext',
                    code: match[2].trim()
                }));

            const textParts = aiResponseValue.split(/```[\s\S]*?```/);
            
            // Remove loading indicator
            loadingIndicator.remove();
            
            // Create AI message container
            const aiMessageContainer = document.createElement("div");
            
            // Add text and code blocks
            textParts.forEach((text, index) => {
                if (text.trim()) {
                    const textContent = document.createElement("div");
                    textContent.innerHTML = DOMPurify.sanitize(marked.parse(text));
                    aiMessageContainer.appendChild(textContent);
                }
                
                if (codeBlocks[index]) {
                    aiMessageContainer.appendChild(
                        ChatUI.createCodeBlock(codeBlocks[index])
                    );
                }
            });

            const aiMessage = ChatUI.createMessageElement(aiMessageContainer);
            messages.appendChild(aiMessage);
            
            // Apply math rendering
            renderMathInElement(aiMessage, {
                delimiters: [
                    { left: "\\(", right: "\\)", display: false },
                    { left: "\\[", right: "\\]", display: true }
                ]
            });
            
        } catch (error) {
            console.error('Chat error:', error);
            const errorMessage = ChatUI.createMessageElement(
                "Sorry, I encountered an error. Please try again."
            );
            messages.appendChild(errorMessage);
        } finally {
            messages.scrollTop = messages.scrollHeight;
            userInput.disabled = false;
            userInput.focus();
        }
    });

    // Model select handler
    document.getElementById("judge0-chat-model-select").addEventListener("change", function () {
        const userInput = document.getElementById("judge0-chat-user-input");
        userInput.placeholder = `Message ${this.value}`;
    });
});

// Keyboard shortcuts
document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
            case "p":
                e.preventDefault();
                document.getElementById("judge0-chat-user-input").focus();
                break;
        }
    }
    // Add selection monitoring for inline questions
let currentWidget = null;
let currentLineNumber = 0;

sourceEditor.onDidChangeCursorSelection(e => {
    const selection = sourceEditor.getSelection();
    
    // Remove existing widget if any
    if (currentWidget) {
        sourceEditor.removeContentWidget(currentWidget);
        currentWidget = null;
    }
    
    if (!selection.isEmpty()) {
        // Create and add widget
        currentWidget = {
            getDomNode: function() {
                const container = document.createElement('div');
                container.className = 'inline-chat-widget';
                container.style.cssText = 'display: flex; gap: 8px; padding: 4px;';
                
                const input = document.createElement('input');
                input.type = 'text';
                input.placeholder = 'Ask about this code...';
                input.style.cssText = 'padding: 4px 8px; border-radius: 4px; border: 1px solid #ccc;';
                
                const askButton = document.createElement('button');
                askButton.innerHTML = '<i class="comment icon"></i>';
                askButton.style.cssText = 'padding: 4px 8px; border-radius: 4px; border: none; background: #0066cc; color: white; cursor: pointer;';
                
                container.appendChild(input);
                container.appendChild(askButton);
                
                askButton.onclick = () => {
                    if (!input.value.trim()) return;
                    const userInput = document.getElementById("judge0-chat-user-input");
                    userInput.value = input.value;
                    input.value = '';
                    userInput.focus();
                };
                
                return container;
            },
            getId: function() {
                return 'inline-chat-widget';
            },
            getPosition: function() {
                return {
                    position: { lineNumber: selection.startLineNumber },
                    preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE]
                };
            }
        };
        sourceEditor.addContentWidget(currentWidget);
    }
});
});