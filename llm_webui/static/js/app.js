// LLM WebUI JavaScript Application
class LLMWebUI {
    constructor() {
        this.currentTab = 'prompt';
        this.models = [];
        this.templates = [];
        this.tools = [];
        this.uploadedFiles = [];
        this.currentChatId = null;
        this.conversations = [];
        
        this.initializeEventListeners();
        this.initializeApp();
    }

    initializeApp() {
        this.showTab('prompt');
        this.loadModels();
        this.loadTemplates();
        this.loadTools();
        this.loadConversations();
    }

    initializeEventListeners() {
        // Tab navigation
        document.querySelectorAll('[data-tab]').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = e.target.closest('[data-tab]').dataset.tab;
                this.showTab(tabName);
            });
        });

        // Prompt form
        document.getElementById('prompt-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.executePrompt();
        });

        // Chat form
        document.getElementById('chat-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendChatMessage();
        });

        // New chat button
        document.getElementById('new-chat').addEventListener('click', () => {
            this.startNewChat();
        });

        // File upload
        const fileInput = document.getElementById('file-upload');
        const dropArea = document.getElementById('file-drop-area');
        fileInput.addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files);
        });
        // Click to open file selector
        dropArea.addEventListener('click', () => fileInput.click());
        // Drag & drop
        ;['dragenter','dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropArea.classList.add('dragover');
            });
        });
        ;['dragleave','drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropArea.classList.remove('dragover');
            });
        });
        dropArea.addEventListener('drop', (e) => {
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
                this.handleFileUpload(e.dataTransfer.files);
            }
        });
        // Clipboard paste for images
        window.addEventListener('paste', async (e) => {
            const items = e.clipboardData && e.clipboardData.items;
            if (!items) return;
            for (const item of items) {
                if (item.kind === 'file') {
                    const file = item.getAsFile();
                    if (file) {
                        await this.uploadFile(file);
                    }
                }
            }
        });

        // Auto-resize chat input
        document.getElementById('chat-input').addEventListener('input', (e) => {
            this.autoResizeTextarea(e.target);
        });

        // Model selection change
        document.getElementById('prompt-model').addEventListener('change', (e) => {
            this.updateModelOptions(e.target.value);
        });

        // Refresh logs button
        document.getElementById('refresh-logs').addEventListener('click', () => {
            this.loadLogs();
        });

        // Options editors
        document.getElementById('add-option').addEventListener('click', () => {
            this.addOptionRow('options-editor');
        });
        document.getElementById('add-chat-option').addEventListener('click', () => {
            this.addOptionRow('chat-options-editor');
        });

        // Conversations UI
        document.getElementById('refresh-conversations').addEventListener('click', () => {
            this.loadConversations();
        });
        document.getElementById('conversation-filter').addEventListener('input', (e) => {
            this.renderConversations(e.target.value.toLowerCase());
        });

        // Help modal
        const helpModalEl = document.getElementById('helpModal');
        this.helpModal = helpModalEl ? new bootstrap.Modal(helpModalEl) : null;
        document.getElementById('open-help').addEventListener('click', () => {
            if (this.helpModal) {
                document.getElementById('help-output').textContent = '';
                document.getElementById('help-path').value = '';
                this.helpModal.show();
            }
        });
        document.getElementById('run-help').addEventListener('click', async () => {
            const path = document.getElementById('help-path').value.trim();
            const out = document.getElementById('help-output');
            out.textContent = 'Loading...';
            try {
                const url = path ? `/api/help?path=${encodeURIComponent(path)}` : '/api/help';
                const res = await fetch(url);
                const data = await res.json();
                out.textContent = `$ ${data.command || 'llm --help'}\n\n${data.help || ''}`;
            } catch (e) {
                out.textContent = 'Failed to load help';
            }
        });
    }

    showTab(tabName) {
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        this.currentTab = tabName;

        // Load data for specific tabs
        if (tabName === 'models') {
            this.displayModels();
        } else if (tabName === 'templates') {
            this.displayTemplates();
        } else if (tabName === 'logs') {
            this.loadLogs();
        }
    }

    async loadModels() {
        try {
            const response = await fetch('/api/models');
            const data = await response.json();
            this.models = Array.isArray(data) ? data : (data.models || []);
            this.populateModelSelects();
        } catch (error) {
            console.error('Failed to load models:', error);
            this.showError('Failed to load models');
        }
    }

    async loadTemplates() {
        try {
            const response = await fetch('/api/templates');
            const data = await response.json();
            this.templates = data.templates || [];
            this.populateTemplateSelects();
        } catch (error) {
            console.error('Failed to load templates:', error);
        }
    }

    async loadTools() {
        try {
            const response = await fetch('/api/tools');
            const data = await response.json();
            this.tools = Array.isArray(data) ? data : (data.tools || []);
            this.populateToolSelects();
        } catch (error) {
            console.error('Failed to load tools:', error);
        }
    }

    populateModelSelects() {
        const selects = ['prompt-model', 'chat-model'];
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            // Clear existing options except the first one
            while (select.children.length > 1) {
                select.removeChild(select.lastChild);
            }
            
            this.models.forEach(model => {
                const option = document.createElement('option');
                option.value = typeof model === 'string' ? model : model.model_id;
                option.textContent = typeof model === 'string' ? model : (model.display_name || model.model_id);
                select.appendChild(option);
            });
        });
    }

    populateTemplateSelects() {
        const select = document.getElementById('prompt-template');
        // Clear existing options except the first one
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }
        
        this.templates.forEach(template => {
            const option = document.createElement('option');
            option.value = template;
            option.textContent = template;
            select.appendChild(option);
        });
    }

    populateToolSelects() {
        const selects = ['prompt-tools', 'chat-tools'];
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            select.innerHTML = '';
            
            this.tools.forEach(tool => {
                const option = document.createElement('option');
                option.value = typeof tool === 'string' ? tool : tool.name;
                option.textContent = typeof tool === 'string' ? tool : tool.name;
                select.appendChild(option);
            });
        });
    }

    async executePrompt() {
        const form = document.getElementById('prompt-form');
        const formData = new FormData(form);
        const responseContainer = document.getElementById('prompt-response');
        
        const promptData = {
            prompt: formData.get('prompt'),
            model: formData.get('model') || null,
            system: formData.get('system') || null,
            template: formData.get('template') || null,
            tools: Array.from(document.getElementById('prompt-tools').selectedOptions).map(opt => opt.value),
            stream: document.getElementById('stream-response').checked
        };

        const extraFlags = document.getElementById('prompt-extra-flags').value.trim();
        if (extraFlags) promptData.extra_args = extraFlags;

        // Attachments (paths and with mime types)
        promptData.attachments = this.uploadedFiles.map(f => f.path);
        promptData.attachment_types = this.uploadedFiles.map(f => [f.path, f.mimetype || 'application/octet-stream']);

        // Options and reasoning
        const rawOptions = this.getOptionsFromEditor('options-editor');
        const { options, reasoning } = this.splitReasoningOptions(rawOptions);
        if (Object.keys(options).length) promptData.options = options;
        if (Object.keys(reasoning).length) promptData.reasoning = reasoning;

        // Clear previous response
        responseContainer.innerHTML = '';
        responseContainer.classList.add('has-content');

        try {
            this.showLoading();
            
            if (promptData.stream) {
                await this.streamResponse('/api/prompt', promptData, responseContainer);
            } else {
                const response = await fetch('/api/prompt', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(promptData)
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();
                responseContainer.innerHTML = this.formatResponse(result.response);
            }
        } catch (error) {
            console.error('Error executing prompt:', error);
            this.showError(`Error: ${error.message}`, responseContainer);
        } finally {
            this.hideLoading();
        }
    }

    async sendChatMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message) return;

        const messagesContainer = document.getElementById('chat-messages');
        
        // Clear welcome message if present
        const welcomeMessage = messagesContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }

        // Add user message
        this.addChatMessage(message, 'user');
        input.value = '';
        this.autoResizeTextarea(input);

        // Add assistant message placeholder
        const assistantMessageEl = this.addChatMessage('', 'assistant');
        const messageContent = assistantMessageEl.querySelector('.message-content');

        const chatData = {
            message: message,
            model: document.getElementById('chat-model').value || null,
            conversation_id: this.currentChatId,
            system: document.getElementById('chat-system').value || null,
            tools: Array.from(document.getElementById('chat-tools').selectedOptions).map(opt => opt.value)
        };

        const extraChatFlags = document.getElementById('chat-extra-flags').value.trim();
        if (extraChatFlags) chatData.extra_args = extraChatFlags;

        // Chat options + reasoning
        const rawOptions = this.getOptionsFromEditor('chat-options-editor');
        const { options, reasoning } = this.splitReasoningOptions(rawOptions);
        if (Object.keys(options).length) chatData.options = options;
        if (Object.keys(reasoning).length) chatData.reasoning = reasoning;

        try {
            await this.streamResponse('/api/chat', chatData, messageContent);
            // After message sent, refresh conversation list and set currentChatId if new
            await this.loadConversations();
            if (!this.currentChatId && this.conversations.length > 0) {
                this.currentChatId = this.conversations[0].conversation_id;
            }
        } catch (error) {
            console.error('Error sending chat message:', error);
            messageContent.textContent = `Error: ${error.message}`;
            messageContent.classList.add('text-danger');
        }
    }

    addChatMessage(content, role) {
        const messagesContainer = document.getElementById('chat-messages');
        
        const messageEl = document.createElement('div');
        messageEl.className = `message ${role}`;
        
        const contentEl = document.createElement('div');
        contentEl.className = 'message-content';
        contentEl.textContent = content;
        
        messageEl.appendChild(contentEl);
        messagesContainer.appendChild(messageEl);
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        return messageEl;
    }

    startNewChat() {
        this.currentChatId = null;
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = `
            <div class="welcome-message text-center p-4">
                <i class="fas fa-robot fa-3x text-muted mb-3"></i>
                <p class="text-muted">Start a conversation with an AI model</p>
            </div>
        `;
        document.getElementById('chat-input').focus();
    }

    async streamResponse(url, data, container) {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                const chunk = decoder.decode(value);
                fullResponse += chunk;
                container.innerHTML = this.formatResponse(fullResponse);
                
                // Auto-scroll chat messages
                if (container.closest('.chat-messages')) {
                    container.closest('.chat-messages').scrollTop = container.closest('.chat-messages').scrollHeight;
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    formatResponse(text) {
        // Basic markdown-like formatting
        return text
            .replace(/\n/g, '<br>')
            .replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>');
    }

    displayModels() {
        const container = document.getElementById('models-list');
        const loading = document.getElementById('models-loading');
        
        loading.classList.add('d-none');
        container.classList.remove('d-none');
        
        if (this.models.length === 0) {
            container.innerHTML = '<p class="text-muted">No models available</p>';
            return;
        }

        container.innerHTML = this.models.map(model => {
            const modelData = typeof model === 'string' ? { model_id: model } : model;
            return `
                <div class="model-card card mb-3">
                    <div class="card-body">
                        <h6 class="card-title">${modelData.display_name || modelData.model_id}</h6>
                        <p class="card-text text-muted">${modelData.model_id}</p>
                        ${modelData.provider ? `<span class="badge bg-primary model-badge">${modelData.provider}</span>` : ''}
                        ${modelData.supports_streaming ? '<span class="badge bg-success model-badge">Streaming</span>' : ''}
                        ${modelData.supports_tools ? '<span class="badge bg-info model-badge">Tools</span>' : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    displayTemplates() {
        const container = document.getElementById('templates-list');
        
        if (this.templates.length === 0) {
            container.innerHTML = '<p class="text-muted">No templates available</p>';
            return;
        }

        container.innerHTML = this.templates.map(template => `
            <div class="template-item">
                <div class="template-name">${template}</div>
            </div>
        `).join('');
    }

    async loadLogs() {
        const container = document.getElementById('logs-list');
        
        try {
            const response = await fetch('/api/logs');
            const data = await response.json();
            const logs = Array.isArray(data) ? data : (data.logs || []);
            
            if (logs.length === 0) {
                container.innerHTML = '<p class="text-muted">No logs available</p>';
                return;
            }

            container.innerHTML = logs.map(log => `
                <div class="log-entry">
                    <div class="log-meta">
                        <strong>Model:</strong> ${log.model || 'Default'} |
                        <strong>Time:</strong> ${log.datetime_utc || 'Unknown'}
                    </div>
                    <div class="log-prompt"><strong>Prompt:</strong> ${this.truncateText(log.prompt || '', 200)}</div>
                    <div class="log-response">${this.truncateText(log.response || '', 500)}</div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Failed to load logs:', error);
            container.innerHTML = '<p class="text-danger">Failed to load logs</p>';
        }
    }

    handleFileUpload(files) {
        Array.from(files).forEach(file => {
            this.uploadFile(file);
        });
    }

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const result = await response.json();
            this.uploadedFiles.push(result);
            this.displayUploadedFiles();
            
            this.showSuccess(`Uploaded: ${file.name}`);
        } catch (error) {
            console.error('Upload error:', error);
            this.showError(`Failed to upload: ${file.name}`);
        }
    }

    displayUploadedFiles() {
        const container = document.getElementById('uploaded-files');
        if (this.uploadedFiles.length === 0) {
            container.innerHTML = '<p class="text-muted">No attachments</p>';
            return;
        }
        container.innerHTML = '';
        this.uploadedFiles.forEach((file, idx) => {
            const item = document.createElement('div');
            item.className = 'd-flex align-items-center justify-content-between border rounded px-2 py-1 mb-1';
            item.innerHTML = `
                <div class="small text-truncate" style="max-width:75%">
                    <i class="fas fa-paperclip me-1"></i>${file.filename || 'file'}
                    <span class="text-muted">(${file.mimetype || 'unknown'})</span>
                </div>
                <button class="btn btn-sm btn-outline-danger" title="Remove"><i class="fas fa-times"></i></button>
            `;
            item.querySelector('button').addEventListener('click', () => {
                this.uploadedFiles.splice(idx, 1);
                this.displayUploadedFiles();
            });
            container.appendChild(item);
        });
    }

    updateModelOptions(modelId) {
        const container = document.getElementById('model-options');
        // This would be implemented to show model-specific options
        container.innerHTML = '<p class="text-muted">Model options would appear here</p>';
    }

    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    showLoading() {
        document.getElementById('loading-overlay').classList.remove('d-none');
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.add('d-none');
    }

    showError(message, container = null) {
        const errorHtml = `<div class="alert alert-danger" role="alert">${message}</div>`;
        if (container) {
            container.innerHTML = errorHtml;
        } else {
            // Show global error message
            console.error(message);
        }
    }

    showSuccess(message) {
        // Implementation for showing success messages
        console.log('Success:', message);
    }

    // Options editor helpers
    addOptionRow(editorId) {
        const editor = document.getElementById(editorId);
        const row = document.createElement('div');
        row.className = 'input-group input-group-sm mb-2';
        row.innerHTML = `
            <span class="input-group-text">-o</span>
            <input type="text" class="form-control" placeholder="key" data-opt-key>
            <input type="text" class="form-control" placeholder="value" data-opt-value>
            <button class="btn btn-outline-danger" type="button" title="Remove"><i class="fas fa-trash"></i></button>
        `;
        row.querySelector('button').addEventListener('click', () => row.remove());
        editor.appendChild(row);
    }

    getOptionsFromEditor(editorId) {
        const editor = document.getElementById(editorId);
        const rows = editor.querySelectorAll('[data-opt-key]');
        const options = {};
        rows.forEach(keyInput => {
            const key = keyInput.value.trim();
            const valueInput = keyInput.parentElement.querySelector('[data-opt-value]');
            const value = (valueInput?.value || '').trim();
            if (!key) return;
            options[key] = value;
        });
        return options;
    }

    splitReasoningOptions(optionsObj) {
        const options = {};
        const reasoning = {};
        for (const [k, v] of Object.entries(optionsObj || {})) {
            if (k.startsWith('reasoning.')) {
                const rk = k.replace(/^reasoning\./, '');
                reasoning[rk] = v;
            } else {
                options[k] = v;
            }
        }
        return { options, reasoning };
    }

    // Conversations
    async loadConversations() {
        try {
            const res = await fetch('/api/conversations');
            const data = await res.json();
            this.conversations = Array.isArray(data) ? data : [];
            this.renderConversations(document.getElementById('conversation-filter').value.toLowerCase());
        } catch (e) {
            console.error('Failed to load conversations', e);
        }
    }

    renderConversations(filter = '') {
        const list = document.getElementById('conversation-list');
        list.innerHTML = '';
        const items = this.conversations.filter(c => {
            const title = c.last_prompt || c.conversation_id || '';
            return title.toLowerCase().includes(filter);
        });
        items.forEach((c, idx) => {
            const li = document.createElement('li');
            li.className = 'list-group-item';
            li.dataset.cid = c.conversation_id;
            li.innerHTML = `
                <div>
                    <div class="conv-title text-truncate">${this.escapeHtml(c.last_prompt || '(no prompt)')}</div>
                    <div class="conv-meta">${c.model || 'model'} • ${c.latest || ''} • ${c.count || 1} msgs</div>
                </div>
            `;
            li.addEventListener('click', () => {
                this.selectConversation(c.conversation_id, li);
            });
            list.appendChild(li);
            // Highlight current
            if (this.currentChatId && this.currentChatId === c.conversation_id) {
                li.classList.add('active');
            } else if (!this.currentChatId && idx === 0) {
                // Auto-select first if none selected
                this.currentChatId = c.conversation_id;
                li.classList.add('active');
                this.selectConversation(c.conversation_id, li);
            }
        });
    }

    async selectConversation(cid, listItemEl) {
        this.currentChatId = cid;
        // Update active class
        const list = document.getElementById('conversation-list');
        list.querySelectorAll('.list-group-item').forEach(li => li.classList.remove('active'));
        listItemEl?.classList.add('active');
        // Load messages into chat panel
        try {
            const res = await fetch(`/api/conversations/${encodeURIComponent(cid)}`);
            const rows = await res.json();
            this.renderConversationMessages(rows);
        } catch (e) {
            console.error('Failed to fetch conversation', e);
        }
    }

    renderConversationMessages(rows) {
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = '';
        // Build alternating user/assistant messages from logs
        rows.forEach(row => {
            if (row.prompt) this.addChatMessage(row.prompt, 'user');
            if (row.response) this.addChatMessage(row.response, 'assistant');
        });
    }

    escapeHtml(str) {
        return (str || '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LLMWebUI();
});