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
    if(currentNote.dataset.starred === "1"){
        starIcon.src = "{{ url_for('static', filename='icons/starred.png') }}";
        starText.textContent = 'Unstar';
    } else {
        starIcon.src = "{{ url_for('static', filename='icons/unstarred.png') }}";
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

document.addEventListener('DOMContentLoaded', function () {
    const addTaskButton = document.getElementById('add-task-button');
    const taskModal = document.getElementById('task-modal');
    const closeModalButton = document.querySelector('.modal-close');
    const taskForm = document.getElementById('task-form');

    if (addTaskButton) {
        addTaskButton.addEventListener('click', function() {
            taskModal.style.display = 'block';
        });
    }

    if (closeModalButton) {
        closeModalButton.addEventListener('click', function() {
            taskModal.style.display = 'none';
        });
    }

    if (taskForm) {
        taskForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const title = document.getElementById('title').value.trim();
            const description = document.getElementById('description').value.trim();
            const deadline = document.getElementById('deadline').value;
            const urgencyId = document.getElementById('urgency_id').value;
            const effortId = document.getElementById('effort_id').value;

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
                status_id: 1 // Assuming 'backlog' status has id 1
            };

            console.log("Data being sent to server:", data); // Log the data being sent to the server

            fetch('/add_task', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            })
            .then(response => {
                console.log("Response received:", response);
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    console.log("Task added successfully:", data);
                    taskModal.style.display = 'none';
                    fetchTasks(); // Refresh tasks
                } else {
                    console.error('Error adding task:', data.error);
                }
            })
            .catch(error => console.error('Error:', error));
        });
    }

    // Function to fetch and display tasks
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
                // Apply initial colors
                document.querySelectorAll('.status-dropdown').forEach(dropdown => {
                    applyOptionColors(dropdown);
                    applySelectedOptionColor(dropdown);

                    // Update colors on change
                    dropdown.addEventListener('change', function () {
                        applySelectedOptionColor(dropdown);
                    });

                    // Apply colors to options on open
                    dropdown.addEventListener('mousedown', function () {
                        applyOptionColors(dropdown);
                    });
                });
            })
            .catch(error => console.error('Error fetching tasks:', error));
    }

    // Function to create a task element
    function createTaskElement(task) {
        const taskElement = document.createElement('div');
        taskElement.className = 'task';
        taskElement.dataset.id = task.id;
        taskElement.dataset.groupId = task.group_id;
        taskElement.innerHTML = `
            <div class="task-header">
                <div class="title">${task.title}</div>
                <div class="status">
                    <select class="status-dropdown" data-task-id="${task.id}">
                        ${task.statuses.map(status => `
                            <option value="${status.id}" data-color="${status.color_hex}" style="color: #${status.color_hex}; background-color: rgba(${hexToRgb(status.color_hex)}, 0.3)" ${status.id === task.status.id ? 'selected' : ''}>
                                ${status.name}
                            </option>
                        `).join('')}
                    </select>
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
                        <span style="color:#${task.effort.color_hex};">${task.effort.name}</span>
                    </div>
                    <div class="progress-tracking task-rating">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 375 374.999991" fill="#219653" class="task-card-icon">
                            <path d="M 328.125 46.875 C 328.125 33.75 317.8125 23.4375 304.6875 23.4375 L 257.8125 23.4375 L 257.8125 11.71875 C 257.8125 5.25 252.5625 0 246.09375 0 L 222.65625 0 C 216.1875 0 210.9375 5.25 210.9375 11.71875 L 210.9375 23.4375 L 117.1875 23.4375 L 117.1875 11.71875 C 117.1875 5.25 111.9375 0 105.46875 0 L 82.03125 0 C 75.5625 0 70.3125 5.25 70.3125 11.71875 L 70.3125 23.4375 L 23.4375 23.4375 C 10.3125 23.4375 0 33.75 0 46.875 L 0 117.1875 L 328.125 117.1875 Z M 328.125 46.875 " fill-opacity="1" fill-rule="nonzero"/><path d="M 269.53125 140.625 L 0 140.625 L 0 304.6875 C 0 317.8125 10.3125 328.125 23.4375 328.125 L 154.804688 328.125 C 145.804688 310.523438 140.625 290.648438 140.625 269.53125 C 140.625 198.328125 198.328125 140.625 269.53125 140.625 Z M 269.53125 140.625 " fill-opacity="1" fill-rule="nonzero"/><path d="M 269.53125 164.0625 C 211.289062 164.0625 164.0625 211.289062 164.0625 269.53125 C 164.0625 327.773438 211.289062 375 269.53125 375 C 327.773438 375 375 327.773438 375 269.53125 C 375 211.289062 327.773438 164.0625 269.53125 164.0625 Z M 316.40625 281.25 L 269.53125 281.25 C 263.0625 281.25 257.8125 276 257.8125 269.53125 L 257.8125 222.65625 C 257.8125 216.1875 263.0625 210.9375 269.53125 210.9375 C 276 210.9375 281.25 216.1875 281.25 222.65625 L 281.25 257.8125 L 316.40625 257.8125 C 322.875 257.8125 328.125 263.0625 328.125 269.53125 C 328.125 276 322.875 281.25 316.40625 281.25 Z M 316.40625 281.25 " fill-opacity="1" fill-rule="nonzero"/>
                        </svg>
                        <span style="color:#219653;">On Track</span>
                    </div>
                </div>
            </div>
        `;
        // Add necessary event listeners
        const statusDropdown = taskElement.querySelector('.status-dropdown');
        statusDropdown.addEventListener('change', function() {
            updateTaskStatus(task.id, statusDropdown.value);
        });
        applyOptionColors(statusDropdown);
        applySelectedOptionColor(statusDropdown);
        return taskElement;
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

    // Event listener for status dropdown change
    document.addEventListener('change', function (event) {
        if (event.target.classList.contains('status-dropdown')) {
            const taskId = event.target.dataset.taskId;
            const newStatusId = event.target.value;
            updateTaskStatus(taskId, newStatusId);
        }
    });

    // Event listener for group title click to toggle visibility
    document.addEventListener('click', function (event) {
        if (event.target.classList.contains('group-title')) {
            const groupId = event.target.closest('.task-group').dataset.groupId;
            const tasksElement = document.querySelector(`.tasks[data-group-id="${groupId}"]`);
            const groupTitleElement = event.target;
            const currentStatus = groupTitleElement.dataset.status;
            const newStatus = currentStatus === 'opened' ? 'collapsed' : 'opened';
            groupTitleElement.dataset.status = newStatus;
            fetch(`/update_group_status/${groupId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: newStatus }),
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        tasksElement.style.display = newStatus === 'collapsed' ? 'none' : 'block';
                    } else {
                        console.error('Error toggling group status');
                    }
                })
                .catch(error => console.error('Error:', error));
        }
    });

    // Apply initial colors
    document.querySelectorAll('.status-dropdown').forEach(dropdown => {
        applyOptionColors(dropdown);
        applySelectedOptionColor(dropdown);

        // Update colors on change
        dropdown.addEventListener('change', function () {
            applySelectedOptionColor(dropdown);
        });

        // Apply colors to options on open
        dropdown.addEventListener('mousedown', function () {
            applyOptionColors(dropdown);
        });
    });

    function applyOptionColors(dropdown) {
        dropdown.querySelectorAll('option').forEach(option => {
            const color = option.getAttribute('data-color');
            if (color) {
                option.style.color = `#${color}`;
                option.style.backgroundColor = `rgba(${hexToRgb(color)}, 0.3)`;
            }
        });
    }

    function applySelectedOptionColor(dropdown) {
        const selectedOption = dropdown.options[dropdown.selectedIndex];
        const color = selectedOption.getAttribute('data-color');
        if (color) {
            dropdown.style.color = `#${color}`;
            dropdown.style.backgroundColor = `rgba(${hexToRgb(color)}, 0.3)`;
        } else {
            dropdown.style.color = '';
            dropdown.style.backgroundColor = '';
        }
    }

    function hexToRgb(hex) {
        let bigint = parseInt(hex, 16);
        let r = (bigint >> 16) & 255;
        let g = (bigint >> 8) & 255;
        let b = bigint & 255;
        return `${r},${g},${b}`;
    }

    // Fetch tasks on page load
    fetchTasks();
});