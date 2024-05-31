        // Resizable sidebar
        const resizer = document.getElementById('resizer');
        const sidebar = document.getElementById('notes-sidebar');
        let isResizing = false;
    
        resizer.addEventListener('mousedown', function(e) {
            isResizing = true; // Set the resizing flag to true
            document.addEventListener('mousemove', resize); // Add mousemove event listener
            document.addEventListener('mouseup', stopResize); // Add mouseup event listener
        });
    
        function resize(e) {
            if (isResizing) {
                const newWidth = window.innerWidth - e.clientX; // Calculate the new width based on mouse position
                sidebar.style.width = newWidth + 'px'; // Set the new width of the sidebar
            }
        }
    
        function stopResize() {
            isResizing = false; // Set the resizing flag to false
            document.removeEventListener('mousemove', resize); // Remove mousemove event listener
            document.removeEventListener('mouseup', stopResize); // Remove mouseup event listener
        }
    
        // Context menu
        const contextMenu = document.getElementById('context-menu');
        let currentNote = null;
        let isEditMode = false;

        // Function to show the context menu
        function showContextMenu(event) {
            event.preventDefault(); // Prevent the default context menu from appearing
            currentNote = event.target.closest('.note_item'); // Get the closest note item element
            contextMenu.style.top = `${event.clientY}px`; // Position the context menu at the mouse click location
            contextMenu.style.left = `${event.clientX}px`;

            // Update star/unstar option based on the current state
            const starIcon = document.getElementById('star-icon');
            const starText = document.getElementById('star-note');
            if(currentNote.dataset.starred === "1"){
                starIcon.src = "{{ url_for('static', filename='icons/starred.png') }}";
                starText.textContent = 'Unstar';
            } else {
                starIcon.src = "{{ url_for('static', filename='icons/unstarred.png') }}";
                starText.textContent = 'Star';
            }
            
            contextMenu.classList.add('active'); // Make the context menu visible
        }

        // Event delegation for context menu actions
        document.getElementById('notes-list').addEventListener('contextmenu', showContextMenu);

        // Hide context menu when clicking elsewhere
        window.addEventListener('click', function(event) {
            if (!contextMenu.contains(event.target)) {
                contextMenu.classList.remove('active');
            }
        });

        // Handle edit action
        document.getElementById('edit-note').addEventListener('click', function() {
            if (currentNote) {
                const noteId = currentNote.getAttribute('data-id');
                const noteContent = currentNote.textContent.trim();
                document.getElementById('note-input').value = noteContent;
                isEditMode = true;
                contextMenu.classList.remove('active'); // Hide context menu after clicking edit
            }
        });

        // Handle delete action
        document.getElementById('delete-note').addEventListener('click', function() {
            if (currentNote) {
                const noteId = currentNote.getAttribute('data-id');
                if (confirm("Are you sure you want to delete this note?")) {
                    fetch(`/delete/${noteId}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            currentNote.remove();
                        } else {
                            alert("Error deleting note");
                            console.error('Error deleting note:', data);
                        }
                        contextMenu.classList.remove('active'); // Hide context menu after clicking delete
                    })
                    .catch(error => {
                        console.error('Error:', error);
                    });
                }
            }
        });

        // Handle form submission
        document.getElementById('notes-form').addEventListener('submit', function(event) {
            event.preventDefault();
            const noteText = document.getElementById('note-input').value.trim();
            if (noteText) {
                if (isEditMode) {
                    const noteId = currentNote.getAttribute('data-id');
                    fetch(`/edit/${noteId}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ note_content: noteText })
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            currentNote.textContent = noteText;
                            document.getElementById('note-input').value = '';
                            isEditMode = false;
                        } else {
                            alert("Error editing note");
                            console.error('Error editing note:', data);
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                    });
                } else {
                    let formData = new FormData();
                    formData.append('note', noteText);
                    fetch('{{ url_for("add_note") }}', {
                        method: 'POST',
                        body: formData
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            let noteElement = document.createElement('li');
                            noteElement.className = 'note_item';
                            noteElement.textContent = noteText;
                            noteElement.setAttribute('data-id', data.note_id);
                            noteElement.setAttribute('data-starred', "0"); // Default to not starred
                            noteElement.addEventListener('contextmenu', showContextMenu);
                            document.getElementById('notes-list').appendChild(noteElement);
                            document.getElementById('note-input').value = '';
                        } else {
                            alert('Error saving note');
                            console.error('Error saving note:', data);
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                    });
                }
            }
        });

        // Handle star/unstar action
        document.getElementById('star-note').addEventListener('click', function() {
            if (currentNote) {
                const noteId = currentNote.getAttribute('data-id');
                const isStarred = currentNote.dataset.starred === "1" ? "0" : "1";
                fetch(`/star/${noteId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ is_starred: isStarred })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        currentNote.dataset.starred = isStarred;
                        contextMenu.classList.remove('active'); // Hide context menu after clicking star/unstar
                    } else {
                        alert(isStarred === "1" ? "Error starring note" : "Error unstarring note");
                        console.error('Error starring/unstarring note:', data);
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                });
            }
        });

        // Smart search functionality
        document.getElementById('search-input').addEventListener('input', function(event) {
            const searchTerm = event.target.value.toLowerCase();
            document.querySelectorAll('.note_item').forEach(note => {
                const noteContent = note.textContent.toLowerCase();
                if (noteContent.includes(searchTerm)) {
                    note.style.display = '';
                } else {
                    note.style.display = 'none';
                }
            });
        });

        // Ensure all notes have the correct event listener for the context menu
        document.querySelectorAll('.note_item').forEach(note => {
            note.addEventListener('contextmenu', showContextMenu);
        });

        // Function to handle drag start
        function handleDragStart(event) {
            currentNote = event.target.closest('.note_item');
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/html', currentNote.outerHTML);
        }

        // Function to handle drag over
        function handleDragOver(event) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            const targetNote = event.target.closest('.note_item');
            if (targetNote && targetNote !== currentNote) {
                targetNote.parentNode.insertBefore(currentNote, targetNote.nextSibling);
            }
        }

        // Function to handle drop
        function handleDrop(event) {
            event.stopPropagation();
            const notesList = document.getElementById('notes-list');
            const updatedOrder = Array.from(notesList.children).map((note, index) => ({
                id: note.getAttribute('data-id'),
                order: index + 1
            }));

            fetch('/update_order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ order: updatedOrder })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log('Order updated successfully');
                } else {
                    console.error('Error updating order:', data);
                }
            })
            .catch(error => {
                console.error('Error:', error);
            });
        }

        // Attach drag and drop event listeners to notes
        document.querySelectorAll('.note_item').forEach(note => {
            note.setAttribute('draggable', true);
            note.addEventListener('dragstart', handleDragStart);
            note.addEventListener('dragover', handleDragOver);
            note.addEventListener('drop', handleDrop);
        });

        // Function to fetch and display a random quote
        function fetchRandomQuote() {
            fetch('/random_quote')
            .then(response => response.json())
            .then(data => {
                document.getElementById('quote-text').textContent = data.quote.toUpperCase();
                document.getElementById('quote-author').textContent = `— ${data.author}`;
            })
            .catch(error => console.error('Error fetching quote:', error));
        }

        // Function to set the interval for fetching quotes every 3 hours
        function startQuoteInterval() {
            fetchRandomQuote(); // Fetch a quote immediately on page load
            setInterval(fetchRandomQuote, 3 * 60 * 60 * 1000); // Fetch a quote every 3 hours
        }

        // Event listener for regenerate button
        document.getElementById('regenerate-quote').addEventListener('click', fetchRandomQuote);

        // Start the quote interval when the page loads
        window.onload = startQuoteInterval;