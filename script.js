

function findClosestMatch(input, keys) {
    let bestMatch = null;
    let highestSimilarity = 0;
    
    for (const key of keys) {
        const similarity = calculateSimilarity(input, key);
        if (similarity > highestSimilarity) {
            highestSimilarity = similarity;
            bestMatch = key;
        }
    }
    return bestMatch ? { key: bestMatch, similarity: highestSimilarity } : null;
}

function calculateSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    if (len1 < 2 || len2 < 2) return 0;
    const commonChars = str1.split('').filter(char => str2.includes(char)).length;
    return (2.0 * commonChars) / (len1 + len2);
}

function processMessage(message) {
    message = message.trim();
    const lowerMessage = message.toLowerCase();
    
    if (responses[lowerMessage]) {
        return {
            type: 'direct',
            response: responses[lowerMessage]
        };
    }

    for (const searchKey of responses["كلمات البحث"]) {
        if (lowerMessage.startsWith(searchKey.toLowerCase())) {
            const searchQuery = message.substring(searchKey.length).trim();
            if (searchQuery) {
                return {
                    type: 'search',
                    query: searchQuery
                };
            }
        }
    }

    if (message.length < 15) {
        const bestMatch = findClosestMatch(lowerMessage, Object.keys(responses));
        if (bestMatch && bestMatch.similarity > 0.7) {
            return {
                type: 'direct',
                response: responses[bestMatch.key]
            };
        }
    }

    if (message.length > 3) {
        return {
            type: 'search',
            query: message
        };
    }

    return {
        type: 'direct',
        response: 'عذراً، لم أفهم طلبك. هل يمكنك إعادة صياغته بطريقة أخرى؟'
    };
}

async function searchForum(query, offset = 0) {
    try {
        if (offset === 0) {
            lastSearchQuery = query;
            lastSearchOffset = 5;
        }

        const searchUrl = `${forumConfig.forumUrl}${forumConfig.searchPath}?search_keywords=${encodeURIComponent(query)}&submit=بحث`;
        
        const response = await fetch(searchUrl);
        if (!response.ok) {
            throw new Error(`خطأ في البحث: ${response.status}`);
        }

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const selectors = [
            '.topictitle',
            'a[href*="viewtopic.php"]',
            '.topic-title',
            'td.row1 a[href*="t="]'
        ];

        let results = [];
        for (const selector of selectors) {
            const elements = doc.querySelectorAll(selector);
            if (elements.length > 0) {
                results = Array.from(elements);
                break;
            }
        }

        if (results.length > 0) {
            let responseText = offset === 0 ? "وجدت بعض النتائج المتعلقة باستفسارك:<br><br>" : "وجدت نتائج إضافية:<br><br>";
            
            const displayResults = results
                .filter(result => {
                    const text = result.textContent.trim();
                    return text.length > 0;
                })
                .slice(offset, offset + 5);

            if (displayResults.length > 0) {
                displayResults.forEach(result => {
                    const title = result.textContent.trim();
                    let url = result.href;

                    if (!url.startsWith('http')) {
                        url = `${forumConfig.forumUrl}${url.startsWith('/') ? '' : '/'}${url}`;
                    }

                    responseText += `• <a href="${url}" target="_blank">${title}</a><br>`;
                });

                // إضافة سؤال عن نتائج إضافية
                if (results.length > offset + 5) {
                    responseText += "<br>يمكنك أن تسألني 'هل هناك نتائج أخرى؟' إذا أردت المزيد.";
                }

                return responseText;
            }
        }
        
        return offset === 0 ? 
            "لم أجد نتائج مطابقة. هل يمكنك تجربة كلمات بحث أخرى؟" : 
            "عذراً، لا توجد نتائج إضافية.";
    } catch (error) {
        console.error('خطأ في البحث:', error);
        return "عذراً، حدث خطأ أثناء البحث. الرجاء المحاولة مرة أخرى لاحقاً.";
    }
}

function processMessage(message) {
    message = message.trim();
    const lowerMessage = message.toLowerCase();
    
    if (responses[lowerMessage]) {
        // التحقق من طلب نتائج إضافية
        if (lastSearchQuery && 
            (lowerMessage === "هل هناك نتائج اخرى" || 
             lowerMessage === "هل هناك غير هذه المواضيع" ||
             lowerMessage === "اريد مواضيع اخرى")) {
            return {
                type: 'search',
                query: lastSearchQuery,
                offset: lastSearchOffset
            };
        }
        return {
            type: 'direct',
            response: responses[lowerMessage]
        };
    }

    for (const searchKey of responses["كلمات البحث"]) {
        if (lowerMessage.startsWith(searchKey)) {
            const searchQuery = message.substring(searchKey.length).trim();
            if (searchQuery) {
                return {
                    type: 'search',
                    query: searchQuery
                };
            }
        }
    }

    return {
        type: 'search',
        query: message
    };
}

function addMessage(text, className, isHTML = false) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${className}`;
    
    if (isHTML) {
        messageDiv.innerHTML = text;
    } else {
        messageDiv.textContent = text;
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageDiv;
}

async function sendMessage() {
    const input = document.getElementById('userInput');
    const message = input.value.trim();
    
    if (message) {
        addMessage(message, 'user-message');
        input.value = '';
        
        const result = processMessage(message);
        
        if (result.type === 'direct') {
            setTimeout(() => {
                if (typeof result.response === 'string') {
                    addMessage(result.response, 'bot-message');
                } else {
                    const response = `${result.response.text}<br><img src="${result.response.image}" alt="صورة">`;
                    addMessage(response, 'bot-message', true);
                }
            }, 500);
        } else if (result.type === 'search') {
            const loadingMessage = addMessage("جاري البحث عن: " + result.query, 'bot-message');
            
            try {
                const searchResults = await searchForum(result.query, result.offset || 0);
                if (result.offset) {
                    lastSearchOffset += 5;
                }
                loadingMessage.remove();
                addMessage(searchResults, 'bot-message', true);
            } catch (error) {
                loadingMessage.remove();
                addMessage("عذراً، حدث خطأ أثناء البحث.", 'bot-message');
            }
        }
    }
}

document.getElementById('userInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});
