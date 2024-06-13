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
    event.preventDefault();
    currentNote = event.target.closest('.note_item');
    const menuHeight = contextMenu.offsetHeight;
    const menuWidth = contextMenu.offsetWidth;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    let top = event.clientY;
    let left = event.clientX;

    if (top + menuHeight > viewportHeight) {
        top -= menuHeight;
    }

    if (left + menuWidth > viewportWidth) {
        left -= menuWidth;
    }

    contextMenu.style.top = `${top}px`;
    contextMenu.style.left = `${left}px`;

    const starIcon = document.getElementById('star-icon');
    const starText = document.getElementById('star-note');
    if (currentNote.dataset.starred === "1") {
        starIcon.src = starredIconUrl;
        starText.textContent = 'Unstar';
    } else {
        starIcon.src = unstarredIconUrl;
        starText.textContent = 'Star';
    }
    
    contextMenu.classList.add('active');
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
        const noteContentElement = currentNote.querySelector('.note_content');
        const noteContent = noteContentElement ? noteContentElement.textContent.trim() : '';
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

// Handle file selection
document.getElementById('file-input').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        console.log('Selected file:', file);
    } else {
        console.log('No file selected');
    }
});

// Handle tag search and selection
document.getElementById('note-input').addEventListener('input', function(event) {
    const input = event.target.value;
    const tagDropdown = document.getElementById('tag-dropdown');
    

    if (input.includes('#')) {
        const tagSearch = input.split('#').pop();
        fetch(`/tags?query=${tagSearch}`)
        .then(response => response.json())
        .then(tags => {
            tagDropdown.innerHTML = '';
            if (tags.length > 0) {
                tags.forEach(tag => {
                    const tagElement = document.createElement('div');
                    tagElement.textContent = tag.name;
                    tagElement.className = 'dropdown-item';
                    tagElement.style.backgroundColor = tag.color_hex;
                    tagElement.addEventListener('click', () => {
                        const selectedTag = document.createElement('span');
                        selectedTag.textContent = tag.name;
                        selectedTag.className = 'selected-tag';
                        document.getElementById('selected-tags').appendChild(selectedTag); // Append to selected tags container
                        event.target.value = event.target.value.replace(`#${tagSearch}`, '').trim() + ' ';
                        tagDropdown.innerHTML = '';
                    });
                    tagDropdown.appendChild(tagElement);
                });
                tagDropdown.style.display = 'block';
            } else {
                tagDropdown.style.display = 'none';
            }
        })
        .catch(error => {
        });
    } else {
        tagDropdown.style.display = 'none';
    }
});

// Handle form submission
document.getElementById('notes-form').addEventListener('submit', function(event) {
    event.preventDefault();
    const noteText = document.getElementById('note-input').value.trim();
    const submitButton = document.querySelector('#notes-form button[type="submit"]');
    const feedbackMessage = document.getElementById('feedback-message');
    const fileInput = document.getElementById('file-input');
    const selectedTags = Array.from(document.querySelectorAll('.selected-tag')).map(tag => tag.textContent.trim());

    if (!noteText && !fileInput.files.length) {
        feedbackMessage.textContent = 'Note content or image must be provided.';
        return;
    }

    submitButton.disabled = true;
    feedbackMessage.textContent = '';

    let formData = new FormData();
    formData.append('note', noteText);
    formData.append('tags', JSON.stringify(selectedTags));
    if (fileInput.files.length) {
        formData.append('file', fileInput.files[0]);
    }

    if (isEditMode && currentNote) {
        const noteId = currentNote.getAttribute('data-id');
        fetch(`/edit/${noteId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ note_content: noteText, tags: selectedTags })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const noteContentElement = currentNote.querySelector('.note_content');
                if (noteContentElement) {
                    noteContentElement.textContent = noteText;
                }
                // Update tags
                const tagElements = currentNote.querySelectorAll('.note_tag');
                tagElements.forEach(tag => tag.remove());
                selectedTags.forEach(tag => {
                    const tagElement = document.createElement('span');
                    tagElement.className = 'note_tag';
                    tagElement.textContent = tag;
                    currentNote.appendChild(tagElement);
                });
                document.getElementById('note-input').value = '';
                isEditMode = false;
            } else {
                feedbackMessage.textContent = 'Error editing note: ' + data.message;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            feedbackMessage.textContent = 'Error editing note. ' + error.message;
        })
        .finally(() => {
            submitButton.disabled = false;
        });
    } else {
        fetch('/add', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => { throw new Error(text) });
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                let noteElement = document.createElement('li');
                noteElement.className = 'note_item';
                noteElement.setAttribute('data-id', data.note_id);
                noteElement.setAttribute('data-starred', "0"); // Default to not starred
                noteElement.innerHTML = `
                    <div class="drag-handle">☰</div>
                    ${data.image_path ? `<img src="/${data.image_path}" alt="Note Image" class="note_image">` : ''}
                    <span class="note_content">${data.note_content}</span>
                    <span class="note_date">${data.created_at}</span>
                    ${data.tags.map(tag => `<span class="note_tag">${tag.name}</span>`).join('')}
                `;
                noteElement.addEventListener('contextmenu', showContextMenu);
                document.getElementById('notes-list').appendChild(noteElement);
                document.getElementById('note-input').value = '';
                fileInput.value = ''; // Clear the file input
                document.getElementById('selected-tags').innerHTML = ''; // Clear selected tags
            } else {
                feedbackMessage.textContent = 'Error saving note: ' + data.message;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            feedbackMessage.textContent = 'Error saving note. ' + error.message;
        })
        .finally(() => {
            submitButton.disabled = false;
        });
    }
});

// Close the dropdown when clicking outside
document.addEventListener('click', function(event) {
    if (!event.target.closest('.input-container')) {
        document.getElementById('tag-dropdown').style.display = 'none';
    }
});

// Get the modal
var modal = document.getElementById('image-fullscreen-modal');

// Get the image and insert it inside the modal - use its "alt" text as a caption
var modalImg = document.getElementById("full-image");
var captionText = document.getElementById("caption");

// Add event listener to dynamically added images
document.addEventListener('click', function(event) {
    if (event.target.classList.contains('note_image')) {
        modal.style.display = "block";
        modalImg.src = event.target.src;
        captionText.innerHTML = event.target.alt;
    }
});

var span = document.getElementsByClassName("image-close")[0];

span.onclick = function() {
    modal.style.display = "none";
}

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
    currentNote.classList.add('dragging');
}

// Function to handle drag over
function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const targetNote = event.target.closest('.note_item');
    if (targetNote && targetNote !== currentNote) {
        const bounding = targetNote.getBoundingClientRect();
        const offset = bounding.y + (bounding.height / 2);
        if (event.clientY - offset > 0) {
            targetNote.parentNode.insertBefore(currentNote, targetNote.nextSibling);
        } else {
            targetNote.parentNode.insertBefore(currentNote, targetNote);
        }
    }
}

// Function to handle drop
function handleDrop(event) {
    event.stopPropagation();
    currentNote.classList.remove('dragging');
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

document.addEventListener('DOMContentLoaded', function() {
    const addTaskButton = document.getElementById('add-task-button');
    const taskModal = document.getElementById('task-modal');
    const closeModalButton = document.querySelector('.modal-close');
    const taskForm = document.getElementById('create-task-form');
    const editTaskModal = document.getElementById('edit-task-modal');
    const closeEditModalButton = document.querySelector('.modal-close-edit');
    const editTaskForm = document.getElementById('edit-task-form');
    const tagInput = document.getElementById('task-tags');
    const tagDropdown = document.getElementById('tag-dropdown');
    let allTags = [];

    // Fetch all tags initially
    fetch('/tags')
        .then(response => response.json())
        .then(data => {
            allTags = data;
        });

    // Open the Add Task Modal
    if (addTaskButton) {
        addTaskButton.addEventListener('click', function() {
            taskModal.style.display = 'block';
            initializeTagDropdown('task-tags', 'selected-tags');
            fetchSelectOptions('/urgencies', document.getElementById('urgency_id'));
            fetchSelectOptions('/efforts', document.getElementById('effort_id'));
        });
    }

    // Close the Add Task Modal
    if (closeModalButton) {
        closeModalButton.addEventListener('click', function() {
            taskModal.style.display = 'none';
            resetForm();
        });
    }

    // Handle Add Task Form Submission
    if (taskForm) {
        taskForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const title = document.getElementById('title').value.trim();
            const description = document.getElementById('description').value.trim();
            const deadline = document.getElementById('deadline').value;
            const urgencyId = document.getElementById('urgency_id').value;
            const effortId = document.getElementById('effort_id').value;
            const selectedTags = Array.from(document.querySelectorAll('#selected-tags .selected-tag')).map(tag => tag.dataset.id);
            const newTags = document.getElementById('task-tags').value.trim().split(',');

            if (!title || !description || !deadline || !urgencyId || !effortId) {
                alert('Please fill out all required fields.');
                return;
            }

            const data = {
                title: title,
                description: description,
                deadline: deadline,
                urgency_id: urgencyId,
                effort_id: effortId,
                status_id: 1, // Assuming 'backlog' status has id 1
                group_id: 1, // Ensure group_id is always set to 1
                tags: selectedTags,
                new_tags: newTags
            };

            fetch('/add_task', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    taskModal.style.display = 'none';
                    fetchTasks(); // Refresh tasks
                    resetForm(); // Reset the form after task creation
                } else {
                    console.error('Error adding task:', data.error);
                }
            })
            .catch(error => console.error('Error:', error));
        });
    }

    // Close the Edit Task Modal
    if (closeEditModalButton) {
        closeEditModalButton.addEventListener('click', function() {
            editTaskModal.style.display = 'none';
        });
    }

    // Handle Edit Task Form Submission
    if (editTaskForm) {
        editTaskForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const taskId = document.getElementById('edit-task-id').value;
            const title = document.getElementById('edit-title').value.trim();
            const description = document.getElementById('edit-description').value.trim();
            const deadline = document.getElementById('edit-deadline').value;
            const urgencyId = document.getElementById('edit-urgency_id').value;
            const effortId = document.getElementById('edit-effort_id').value;
            const statusId = document.getElementById('edit-status_id').value;
            const selectedTags = Array.from(document.querySelectorAll('#edit-selected-tags .selected-tag')).map(tag => tag.dataset.id);

            if (!title || !description || !deadline || !urgencyId || !effortId || !statusId) {
                alert('Please fill out all required fields.');
                return;
            }

            const data = {
                title: title,
                description: description,
                deadline: deadline,
                urgency_id: urgencyId,
                effort_id: effortId,
                status_id: statusId,
                tags: selectedTags
            };

            fetch(`/edit_task/${taskId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    editTaskModal.style.display = 'none';
                    fetchTasks(); // Refresh tasks
                } else {
                    console.error('Error editing task:', data.error);
                }
            })
            .catch(error => console.error('Error:', error));
        });
    }

    function resetForm() {
        document.getElementById('create-task-form').reset();
        document.getElementById('task-tags').value = '';
        document.getElementById('selected-tags').innerHTML = '';
    }

    // function for task deadline
    function getDaySuffix(day) {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    }

    // Function to format the date to "Month day"
    function formatDateToMonthDay(dateString) {
        const date = new Date(dateString);
        const options = { month: 'long' };
        const month = date.toLocaleDateString('en-US', options);
        const day = date.getDate();
        const daySuffix = getDaySuffix(day);
        return `${month} ${day}${daySuffix}`;
    } 

    // Fetch and display tasks
    function fetchTasks() {
        fetch('/tasks')
            .then(response => response.json())
            .then(data => {
                const taskGroups = document.querySelectorAll('.tasks');
                taskGroups.forEach(group => group.innerHTML = ''); // Clear current tasks
                data.forEach(task => {
                    const taskElement = createTaskElement(task);
                    const groupElement = document.querySelector(`.tasks[data-group-id="${task.group_id}"]`);
                    if (groupElement) {
                        groupElement.appendChild(taskElement);
                    }
                });
                updateTaskCounts();
            })
            .catch(error => console.error('Error fetching tasks:', error));
    }

    // Create a task element
    function createTaskElement(task) {
        const taskElement = document.createElement('div');
        taskElement.className = 'task';
        taskElement.dataset.id = task.id;
        taskElement.dataset.groupId = task.group_id;

        const daysLeft = calculateDaysLeft(task.deadline);
        const deadlineColor = getDeadlineColor(task.deadline);
        const deadlineStatus = getDeadlineStatus(task.deadline);

        // Fetch the tags for the task
        const tagsHtml = task.tags.map(tag => `
            <span class="tag-text" style="background-color: ${tag.color_hex};">${tag.name}</span>
        `).join('');

        taskElement.innerHTML = `
            <div class="task-header">
                <div class="task-top-header">
                    <div class="title">${task.title}</div>
                    <div class="status">
                        <div id="app-cover">
                            <div id="select-box-${task.id}">
                                <div id="select-button-${task.id}" class="brd" data-selected-color="rgba(${hexToRgb(task.status.color_hex)}, 0.3)" data-selected-text-color="#${task.status.color_hex}">
                                    <div id="selected-value-${task.id}">
                                        <span class="selected-status">${task.status.name}</span>
                                    </div>
                                </div>
                                <div id="options-${task.id}" class="options">
                                    ${task.statuses.map(status => `
                                        <div class="option" data-status-id="${status.id}" style="background-color: rgba(${hexToRgb(status.color_hex)}, 0.3); color: #${status.color_hex};">
                                            <input class="s-c" type="radio" name="status-${task.id}" value="${status.id}">
                                            <span class="label">${status.name}</span>
                                            <span class="opt-val">${status.name}</span>
                                        </div>
                                    `).join('')}
                                    <div id="option-bg"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="task-bottom-header">
                    <div class="tags-container">
                        <div class="tag-background">${tagsHtml}</div>
                    </div>
                    <div class="deadline">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 375 374.999991" fill="#${task.urgency.color_hex}" class="task-card-icon">
                            <path fill="#FFFFFF" d="M 0 75.894531 C 0 51.238281 19.988281 31.25 44.644531 31.25 L 330.355469 31.25 C 355.011719 31.25 375 51.238281 375 75.894531 L 375 111.605469 C 375 116.539062 371 120.535156 366.070312 120.535156 L 8.929688 120.535156 C 3.996094 120.535156 0 116.539062 0 111.605469 Z M 44.644531 49.105469 C 29.847656 49.105469 17.855469 61.097656 17.855469 75.894531 L 17.855469 102.679688 L 357.144531 102.679688 L 357.144531 75.894531 C 357.144531 61.097656 345.148438 49.105469 330.355469 49.105469 Z M 44.644531 49.105469 " fill-opacity="1" fill-rule="evenodd"/><path fill="#FFFFFF" d="M 0 111.605469 C 0 106.675781 3.996094 102.679688 8.929688 102.679688 L 366.070312 102.679688 C 371 102.679688 375 106.675781 375 111.605469 L 375 147.320312 L 357.144531 147.320312 L 357.144531 120.535156 L 17.855469 120.535156 L 17.855469 325.894531 C 17.855469 340.6875 29.847656 352.679688 44.644531 352.679688 L 151.785156 352.679688 L 151.785156 370.535156 L 44.644531 370.535156 C 19.988281 370.535156 0 350.546875 0 325.894531 Z M 0 111.605469 " fill-opacity="1" fill-rule="evenodd"/><path fill="#FFFFFF" d="M 178.570312 4.464844 L 196.429688 4.464844 L 196.429688 58.035156 L 178.570312 58.035156 Z M 178.570312 4.464844 " fill-opacity="1" fill-rule="evenodd"/><path fill="#FFFFFF" d="M 267.855469 4.464844 L 285.714844 4.464844 L 285.714844 58.035156 L 267.855469 58.035156 Z M 267.855469 4.464844 " fill-opacity="1" fill-rule="evenodd"/><path fill="#FFFFFF" d="M 89.285156 4.464844 L 107.144531 4.464844 L 107.144531 58.035156 L 89.285156 58.035156 Z M 89.285156 4.464844 " fill-opacity="1" fill-rule="evenodd"/><path fill="#FFFFFF" d="M 232.144531 218.75 C 232.144531 213.820312 236.140625 209.820312 241.070312 209.820312 L 330.355469 209.820312 C 335.289062 209.820312 339.285156 213.820312 339.285156 218.75 L 339.285156 238.65625 C 339.285156 244.335938 338.203125 249.964844 336.09375 255.238281 L 320.789062 293.496094 C 319.433594 296.882812 316.152344 299.105469 312.5 299.105469 L 258.929688 299.105469 C 255.277344 299.105469 251.996094 296.882812 250.640625 293.496094 L 235.335938 255.238281 C 233.226562 249.964844 232.144531 244.335938 232.144531 238.65625 Z M 250 227.679688 L 250 238.65625 C 250 242.066406 250.648438 245.441406 251.917969 248.605469 L 264.972656 281.25 L 306.457031 281.25 L 319.511719 248.605469 C 320.777344 245.441406 321.429688 242.066406 321.429688 238.65625 L 321.429688 227.679688 Z M 250 227.679688 " fill-opacity="1" fill-rule="evenodd"/><path fill="#FFFFFF" d="M 232.144531 361.605469 C 232.144531 366.539062 236.140625 370.535156 241.070312 370.535156 L 330.355469 370.535156 C 335.289062 370.535156 339.285156 366.539062 339.285156 361.605469 L 339.285156 341.699219 C 339.285156 336.019531 338.203125 330.394531 336.09375 325.121094 L 320.789062 286.863281 C 319.433594 283.472656 316.152344 281.25 312.5 281.25 L 258.929688 281.25 C 255.277344 281.25 251.996094 283.472656 250.640625 286.863281 L 235.335938 325.121094 C 233.226562 330.394531 232.144531 336.019531 232.144531 341.699219 Z M 250 352.679688 L 250 341.699219 C 250 338.292969 250.648438 334.917969 251.917969 331.75 L 264.972656 299.105469 L 306.457031 299.105469 L 319.511719 331.75 C 320.777344 334.917969 321.429688 338.292969 321.429688 341.699219 L 321.429688 352.679688 Z M 250 352.679688 " fill-opacity="1" fill-rule="evenodd"/><path fill="#FFFFFF" d="M 205.355469 209.820312 L 366.070312 209.820312 L 366.070312 227.679688 L 205.355469 227.679688 Z M 205.355469 209.820312 " fill-opacity="1" fill-rule="evenodd"/><path fill="#FFFFFF" d="M 205.355469 352.679688 L 366.070312 352.679688 L 366.070312 370.535156 L 205.355469 370.535156 Z M 205.355469 352.679688 " fill-opacity="1" fill-rule="evenodd"/>
                        </svg>
                        <span class="deadline-date">${formatDateToMonthDay(task.deadline)}</span>
                    </div>
                </div>
            </div>
            <hr class="task-header-divider">
            <div class="task-body">
                <p class="description">${task.description}</p>
                <div class="task-metadata">
                    <div class="urgency task-rating">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 375 374.999991" fill="#${task.urgency.color_hex}" class="task-card-icon">
                            <path d="M 366.203125 170.417969 L 206.007812 10.222656 C 196.183594 0.398438 180.242188 0.398438 170.402344 10.222656 L 10.222656 170.417969 C 0.398438 180.242188 0.398438 196.183594 10.222656 206.023438 L 170.417969 366.214844 C 180.242188 376.039062 196.183594 376.039062 206.023438 366.214844 L 366.214844 206.023438 C 376.027344 196.183594 376.027344 180.242188 366.203125 170.417969 Z M 205.496094 88.402344 L 202.640625 216.730469 L 173.785156 216.730469 L 170.929688 88.402344 Z M 188.253906 290.71875 C 176.449219 290.71875 169.390625 284.429688 169.390625 273.863281 C 169.390625 263.097656 176.433594 256.8125 188.253906 256.8125 C 199.976562 256.8125 207.019531 263.097656 207.019531 273.863281 C 207.019531 284.429688 199.976562 290.71875 188.253906 290.71875 Z M 188.253906 290.71875 " fill-opacity="1" fill-rule="nonzero"/>
                        </svg>
                        <span style="color:#${task.urgency.color_hex};">${task.urgency.name}</span>
                    </div>
                    <div class="effort task-rating">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 375 374.999991" fill="#${task.effort.color_hex}" class="task-card-icon">
                            <path d="M 369.699219 110.742188 L 341.371094 82.414062 C 338.777344 79.820312 338.777344 75.632812 341.371094 73.039062 C 352.203125 62.65625 352.21875 43.964844 341.371094 33.671875 C 331.050781 22.785156 312.34375 22.851562 302.003906 33.671875 C 299.542969 36.132812 295.089844 36.132812 292.628906 33.671875 C 292.628906 33.671875 264.300781 5.34375 264.300781 5.34375 C 259.113281 0.0898438 250.136719 0.15625 244.949219 5.34375 L 216.621094 33.605469 C 214.027344 36.199219 209.835938 36.199219 207.242188 33.605469 C 196.335938 22.765625 178.714844 22.765625 167.808594 33.605469 C 156.96875 44.511719 156.96875 62.132812 167.808594 73.039062 C 170.515625 75.726562 170.359375 80.132812 167.542969 82.679688 C 167.542969 82.679688 139.546875 110.742188 139.546875 110.742188 C 134.167969 115.777344 134.203125 125.007812 139.546875 130.09375 C 139.546875 130.09375 163.488281 154.035156 163.488281 154.035156 C 179.578125 142.53125 202.1875 143.992188 216.621094 158.355469 C 231.050781 172.851562 232.511719 195.464844 220.941406 211.554688 L 244.949219 235.496094 C 250.269531 240.882812 258.980469 240.882812 264.300781 235.496094 L 288.304688 211.554688 C 276.519531 195.84375 278.417969 172.046875 292.628906 158.355469 C 307.058594 143.992188 329.667969 142.53125 345.695312 154.035156 L 369.699219 130.09375 C 374.972656 124.992188 375.015625 115.835938 369.699219 110.742188 Z M 369.699219 110.742188 " fill-opacity="1" fill-rule="nonzero"/><path d="M 207.175781 216.675781 C 204.53125 214.070312 204.632812 209.734375 207.242188 207.234375 C 232.390625 180.308594 194.75 142.625 167.808594 167.800781 C 165.214844 170.394531 161.027344 170.394531 158.367188 167.800781 L 130.105469 139.472656 C 124.984375 134.351562 115.875 134.351562 110.753906 139.472656 L 86.746094 163.476562 C 113.550781 201.597656 67.054688 247.359375 29.359375 220.933594 C 29.359375 220.933594 5.351562 244.9375 5.351562 244.9375 C -0.0234375 250.046875 0 259.171875 5.351562 264.289062 C 5.351562 264.289062 8.144531 267.148438 8.144531 267.148438 C 8.210938 267.214844 8.210938 267.28125 8.277344 267.28125 C 8.222656 267.332031 29.289062 288.152344 29.292969 288.230469 C 44.996094 276.566406 68.816406 278.359375 82.425781 292.617188 C 96.660156 306.242188 98.492188 330.011719 86.8125 345.683594 C 86.8125 345.683594 110.753906 369.625 110.753906 369.625 C 115.941406 374.878906 124.917969 374.878906 130.105469 369.691406 L 158.367188 341.363281 C 161.027344 338.769531 165.214844 338.769531 167.808594 341.363281 C 178.648438 352.269531 196.402344 352.269531 207.242188 341.363281 C 218.082031 330.523438 218.082031 312.902344 207.242188 301.996094 C 204.648438 299.402344 204.648438 295.210938 207.242188 292.617188 L 235.503906 264.355469 C 238.03125 261.761719 239.496094 258.304688 239.496094 254.648438 C 239.496094 250.988281 238.03125 247.597656 235.503906 245.003906 Z M 207.175781 216.675781 " fill-opacity="1" fill-rule="nonzero"/>
                        </svg>
                        <span style="color:#${task.urgency.color_hex};">${task.urgency.name}</span>
                    </div>
                    <div class="time-tracking task-rating" title="${daysLeft} days left">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 375 374.999991" fill="${deadlineColor}" class="task-card-icon">
                            <path d="M 328.125 46.875 C 328.125 33.75 317.8125 23.4375 304.6875 23.4375 L 257.8125 23.4375 L 257.8125 11.71875 C 257.8125 5.25 252.5625 0 246.09375 0 L 222.65625 0 C 216.1875 0 210.9375 5.25 210.9375 11.71875 L 210.9375 23.4375 L 117.1875 23.4375 L 117.1875 11.71875 C 117.1875 5.25 111.9375 0 105.46875 0 L 82.03125 0 C 75.5625 0 70.3125 5.25 70.3125 11.71875 L 70.3125 23.4375 L 23.4375 23.4375 C 10.3125 23.4375 0 33.75 0 46.875 L 0 117.1875 L 328.125 117.1875 Z M 328.125 46.875 " fill-opacity="1" fill-rule="nonzero"/><path d="M 269.53125 140.625 L 0 140.625 L 0 304.6875 C 0 317.8125 10.3125 328.125 23.4375 328.125 L 154.804688 328.125 C 145.804688 310.523438 140.625 290.648438 140.625 269.53125 C 140.625 198.328125 198.328125 140.625 269.53125 140.625 Z M 269.53125 140.625 " fill-opacity="1" fill-rule="nonzero"/><path d="M 269.53125 164.0625 C 211.289062 164.0625 164.0625 211.289062 164.0625 269.53125 C 164.0625 327.773438 211.289062 375 269.53125 375 C 327.773438 375 375 327.773438 375 269.53125 C 375 211.289062 327.773438 164.0625 269.53125 164.0625 Z M 316.40625 281.25 L 269.53125 281.25 C 263.0625 281.25 257.8125 276 257.8125 269.53125 L 257.8125 222.65625 C 257.8125 216.1875 263.0625 210.9375 269.53125 210.9375 C 276 210.9375 281.25 216.1875 281.25 222.65625 L 281.25 257.8125 L 316.40625 257.8125 C 322.875 257.8125 328.125 263.0625 328.125 269.53125 C 328.125 276 322.875 281.25 316.40625 281.25 Z M 316.40625 281.25 " fill-opacity="1" fill-rule="nonzero"/>
                        </svg>
                        <span style="color:${deadlineColor};">${deadlineStatus}</span>
                    </div>
                </div>
            </div>
        `;

        // Add event listeners for custom dropdown
        const selectBox = taskElement.querySelector(`#select-box-${task.id}`);
        const selectButton = taskElement.querySelector(`#select-button-${task.id}`);
        const selectedValue = taskElement.querySelector(`#selected-value-${task.id}`);
        const optionsContainer = taskElement.querySelector(`#options-${task.id}`);
        const cardStatus = taskElement.querySelector(`#selected-value-${task.id} span`);
        cardStatus.style.backgroundColor = `rgba(${hexToRgb(task.status.color_hex)}, 0.3)`;
        cardStatus.style.color = `#${task.status.color_hex}`;

        selectedValue.addEventListener('click', (event) => {
            event.stopPropagation();
            optionsContainer.classList.toggle('active');
        });

        optionsContainer.querySelectorAll('.option').forEach(option => {
            option.addEventListener('click', (event) => {
                const newStatusId = event.currentTarget.dataset.statusId;
                updateTaskStatus(task.id, newStatusId);
                selectedValue.querySelector('span').textContent = event.currentTarget.querySelector('.label').textContent;
                selectButton.style.backgroundColor = event.currentTarget.style.backgroundColor;
                selectButton.style.color = event.currentTarget.style.color;
                cardStatus.style.backgroundColor = event.currentTarget.style.backgroundColor;
                cardStatus.style.color = event.currentTarget.style.color;
                optionsContainer.classList.remove('active');
            });
        });

        window.addEventListener('click', function(event) {
            if (!selectBox.contains(event.target)) {
                optionsContainer.classList.remove('active');
            }
        });

        // Add event listener for opening edit modal
        taskElement.addEventListener('click', function(event) {
            if (!event.target.closest('.status')) { // Prevent opening modal when clicking on status dropdown
                openEditTaskModal(task.id); // Use task.id directly
            }
        });

        return taskElement;
    }

    // Function to populate select options
    function populateSelectOptions(selectElement, options, selectedId) {
        selectElement.innerHTML = ''; // Clear existing options
        options.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option.id;
            opt.textContent = option.name;
            if (option.id === selectedId) {
                opt.selected = true;
            }
            selectElement.appendChild(opt);
        });
    }

    // Function to get task by ID
    function getTaskById(taskId) {
        return fetch(`/get_task/${taskId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .catch(error => {
                console.error('There was a problem with the fetch operation:', error);
            });
    }

    // Function to fetch and populate select options
    function fetchSelectOptions(url, selectElement, selectedIds = []) {
        fetch(url)
            .then(response => response.json())
            .then(data => {
                selectElement.innerHTML = ''; // Clear existing options
                data.forEach(option => {
                    const opt = document.createElement('option');
                    opt.value = option.id;
                    opt.textContent = option.name;
                    if (selectedIds.includes(option.id)) {
                        opt.selected = true;
                    }
                    selectElement.appendChild(opt);
                });
            })
            .catch(error => console.error('Error fetching select options:', error));
    }

    // Function to open the edit task modal
    function openEditTaskModal(taskId) {
        console.log('Opening edit modal for task ID:', taskId); // Debug log

        getTaskById(taskId).then(task => {
            if (task) {
                console.log('Task data:', task); // Debug log

                document.getElementById('edit-task-id').value = task.id;
                document.getElementById('edit-title').value = task.title;
                document.getElementById('edit-description').value = task.description;
                document.getElementById('edit-deadline').value = task.deadline.split('T')[0]; // Format date properly

                // Populate urgency, effort, and status dropdowns dynamically
                fetchSelectOptions('/urgencies', document.getElementById('edit-urgency_id'), [task.urgency_id]);
                fetchSelectOptions('/efforts', document.getElementById('edit-effort_id'), [task.effort_id]);
                fetchSelectOptions('/statuses', document.getElementById('edit-status_id'), [task.status.id]);

                // Open the modal
                document.getElementById('edit-task-modal').style.display = 'block';
            } else {
                alert('Failed to load task details.');
            }
        }).catch(error => {
            console.error('Error fetching task details:', error);
            alert('Failed to load task details.');
        });
    }

    // Function to update task status and group
    function updateTaskStatus(taskId, newStatusId) {
        fetch(`/update_task_status/${taskId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status_id: newStatusId }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const taskElement = document.querySelector(`.task[data-id="${taskId}"]`);
                const oldGroupElement = taskElement.closest('.tasks');
                const newGroupId = data.new_group_id;
                const newGroupElement = document.querySelector(`.tasks[data-group-id="${newGroupId}"]`);
                oldGroupElement.removeChild(taskElement);
                newGroupElement.appendChild(taskElement);
                updateTaskCounts(); // Update task counts
            } else {
                console.error('Error updating task status');
            }
        })
        .catch(error => console.error('Error:', error));
    }

    // Function to update task counts for each group
    function updateTaskCounts() {
        document.querySelectorAll('.task-group').forEach(group => {
            const taskCount = group.querySelector('.tasks').children.length;
            group.querySelector('.task-count').textContent = taskCount;
        });
    }

    document.getElementById('delete-task-button').addEventListener('click', function() {
        const taskId = document.getElementById('edit-task-id').value;
        if (confirm('Are you sure you want to delete this task?')) {
            deleteTask(taskId);
        }
    });

    function deleteTask(taskId) {
        fetch(`/delete_task/${taskId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                document.getElementById('edit-task-modal').style.display = 'none';
                fetchTasks(); // Refresh tasks
            } else {
                console.error('Error deleting task:', data.error);
            }
        })
        .catch(error => console.error('Error:', error));
    }

    // Event listener for group title click to toggle visibility
    document.addEventListener('click', function (event) {
        if (event.target.classList.contains('group-title')) {
            const groupId = event.target.closest('.task-group').dataset.groupId;
            const tasksElement = document.querySelector(`.tasks[data-group-id="${groupId}"]`);
            const groupTitleElement = event.target;
            const currentStatus = groupTitleElement.dataset.status;
            const newStatus = currentStatus === 'opened' ? 'collapsed' : 'opened';
            groupTitleElement.dataset.status = newStatus;

            // Toggle the visibility of the tasks
            if (newStatus === 'collapsed') {
                tasksElement.classList.add('collapsed');
            } else {
                tasksElement.classList.remove('collapsed');
            }

            // Update the group status in the database
            fetch(`/update_group_status/${groupId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: newStatus }),
            })
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    console.error('Error toggling group status');
                }
            })
            .catch(error => console.error('Error:', error));
        }
    });

    fetchTasks();

    function hexToRgb(hex) {
        let bigint = parseInt(hex, 16);
        let r = (bigint >> 16) & 255;
        let g = (bigint >> 8) & 255;
        let b = bigint & 255;
        return `${r},${g},${b}`;
    }

    function calculateDaysLeft(deadline) {
        const today = new Date();
        const deadlineDate = new Date(deadline);
        const timeDiff = deadlineDate - today;
        const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
        return daysLeft;
    }
    
    function getDeadlineColor(deadline) {
        const daysLeft = calculateDaysLeft(deadline);
        if (daysLeft > 2) {
            return '#219653';
        } else if (daysLeft >= 0 && daysLeft <= 2) {
            return '#F2C94C';
        } else {
            return '#EB5757';
        }
    }
    
    function getDeadlineStatus(deadline) {
        const daysLeft = calculateDaysLeft(deadline);
        if (daysLeft > 2) {
            return 'On Track';
        } else if (daysLeft >= 0 && daysLeft <= 2) {
            return 'Attention';
        } else {
            return 'Overdue';
        }
    }

    // Tag-related functionality
    function initializeTagDropdown(inputId, containerId) {
        const tagInput = document.getElementById(inputId);
        const tagContainer = document.getElementById(containerId);
        tagInput.addEventListener('input', function() {
            const query = tagInput.value;
            if (query.length > 0) {
                fetchTags(query).then(tags => {
                    displayTagSuggestions(tags, tagContainer, tagInput);
                });
            } else {
                tagContainer.innerHTML = '';
            }
        });
    }

    function fetchTags(query) {
        return fetch(`/tags?query=${query}`)
            .then(response => response.json())
            .catch(error => {
                console.error('Error fetching tags:', error);
                return [];
            });
    }

    function displayTagSuggestions(tags, container, input) {
        container.innerHTML = '';
        tags.forEach(tag => {
            const tagElement = document.createElement('div');
            tagElement.className = 'tag-suggestion';
            tagElement.textContent = tag.name;
            tagElement.dataset.id = tag.id;
            tagElement.addEventListener('click', function() {
                addTagToSelected(tag, input);
            });
            container.appendChild(tagElement);
        });
    }

    function addTagToSelected(tag, input) {
        const selectedTagsContainer = document.getElementById(input.dataset.selectedContainer);
        const selectedTagElement = document.createElement('span');
        selectedTagElement.className = 'selected-tag';
        selectedTagElement.textContent = tag.name;
        selectedTagElement.dataset.id = tag.id;
        selectedTagElement.addEventListener('click', function() {
            selectedTagElement.remove();
        });
        selectedTagsContainer.appendChild(selectedTagElement);
        input.value = '';
        input.nextSibling.innerHTML = '';
    }

});