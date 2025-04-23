// rich-admin.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const templateSelect = document.getElementById('template-select');
    const loadTemplateBtn = document.getElementById('load-template-btn');
    const newTemplateBtn = document.getElementById('new-template-btn');
    const saveTemplateBtn = document.getElementById('save-template-btn');
    const deleteTemplateBtn = document.getElementById('delete-template-btn');
    const templateEditor = document.getElementById('template-editor');
    const statusMessage = document.getElementById('status-message');

    // Template Editor Inputs
    const templateIdInput = document.getElementById('template-id');
    const templateNameInput = document.getElementById('template-name');
    const templateDescriptionInput = document.getElementById('template-description');
    // ... (Get ALL template input elements by their ID - Example for one section)
    const generalPageBgColorInput = document.getElementById('general-pageBgColor');
    const generalPrimaryTextColorInput = document.getElementById('general-primaryTextColor');
    const generalPrimaryFontFamilyInput = document.getElementById('general-primaryFontFamily');
    // ... (Get inputs for Header, Board, MapCell, PlayerMarker, Controller, Info, Connection, Modal sections) ...
    const playerMarkerColorInputs = [
        document.getElementById('playerMarker-color1'),
        document.getElementById('playerMarker-color2'),
        document.getElementById('playerMarker-color3'),
        document.getElementById('playerMarker-color4'),
        document.getElementById('playerMarker-color5'),
    ];
    const modalHeaderBgColorInput_Template = document.getElementById('modal-headerBgColor'); // Template default

    // Map Cell Editor Elements
    const adminMapGrid = document.getElementById('admin-map-grid');
    const saveAllCellDataBtn = document.getElementById('save-all-cell-data-btn');

    // Cell Edit Modal Elements
    const cellEditModal = document.getElementById('cell-edit-modal');
    const modalCellIndexDisplay = document.getElementById('modal-cell-index-display');
    const editingCellIndexInput = document.getElementById('editing-cell-index');
    const modalCellTitleInput = document.getElementById('modal-cell-title-input');
    const modalCellDescTextarea = document.getElementById('modal-cell-desc-textarea');
    const modalCellBgColorInput = document.getElementById('modal-cell-bg-color-input');
    const modalModalHeaderBgColorInput = document.getElementById('modal-modal-header-bg-color-input');
    const saveModalChangesBtn = document.getElementById('save-modal-changes-btn');

    // --- State Variables ---
    let currentEditingTemplateId = null;
    let currentCellInfo = []; // Stores cell data [{ title, description, cell_bg_color, modal_header_bg_color }, ...]
    let cellDataChanged = false; // Flag for unsaved cell changes

    // --- Initialization ---
    loadTemplateList();
    loadCellDataAndRenderAdminGrid();

    // --- Event Listeners ---
    loadTemplateBtn.addEventListener('click', handleLoadTemplate);
    newTemplateBtn.addEventListener('click', handleNewTemplate);
    saveTemplateBtn.addEventListener('click', handleSaveTemplate);
    deleteTemplateBtn.addEventListener('click', handleDeleteTemplate);
    saveAllCellDataBtn.addEventListener('click', saveAllCellDataToBackend);
    saveModalChangesBtn.addEventListener('click', saveModalChangesToLocal);

    // --- Template Functions ---
    async function loadTemplateList() {
        try {
            const response = await fetch('/api/admin/walk_map/templates');
            if (!response.ok) throw new Error(`Failed to fetch templates: ${response.statusText}`);
            const templates = await response.json();

            templateSelect.innerHTML = '<option value="">-- 請選擇或新增 --</option>'; // Reset
            templates.forEach(t => {
                const option = document.createElement('option');
                option.value = t.template_id;
                option.textContent = t.template_name;
                templateSelect.appendChild(option);
            });
            console.log("Template list loaded.");
        } catch (error) {
            displayStatus(`Error loading templates: ${error.message}`, true);
        }
    }

    async function handleLoadTemplate() {
        const selectedId = templateSelect.value;
        if (!selectedId) {
            displayStatus("Please select a template to load.", true);
            return;
        }
        clearTemplateEditor(); // Clear first
        try {
            const response = await fetch(`/api/admin/walk_map/templates/${selectedId}`);
            if (!response.ok) throw new Error(`Failed to load template ${selectedId}: ${response.statusText}`);
            const template = await response.json();
            populateTemplateEditor(template);
            templateEditor.classList.remove('hidden');
            deleteTemplateBtn.classList.remove('hidden');
            currentEditingTemplateId = selectedId; // Track the loaded template
            displayStatus(`Template "${template.template_name}" loaded.`);
        } catch (error) {
            displayStatus(`Error loading template: ${error.message}`, true);
            templateEditor.classList.add('hidden');
            deleteTemplateBtn.classList.add('hidden');
        }
    }

    function handleNewTemplate() {
        clearTemplateEditor();
        templateIdInput.value = generateTemplateId(); // Generate a suggested ID
        templateNameInput.value = "新的模板";
        templateEditor.classList.remove('hidden');
        deleteTemplateBtn.classList.add('hidden');
        currentEditingTemplateId = null; // Indicate new template
        displayStatus("Enter settings for the new template.");
    }

    async function handleSaveTemplate() {
        const templateId = templateIdInput.value.trim();
        const templateName = templateNameInput.value.trim();
        if (!templateId || !templateName) {
            displayStatus("Template ID and Name are required.", true);
            return;
        }

        const styleData = collectStyleData();
        const templateData = {
            template_id: templateId,
            template_name: templateName,
            description: templateDescriptionInput.value.trim(),
            style_data: styleData
        };

        const method = currentEditingTemplateId ? 'PUT' : 'POST';
        const url = currentEditingTemplateId ? `/api/admin/walk_map/templates/${currentEditingTemplateId}` : '/api/admin/walk_map/templates';

        // If it's a new template but the ID was changed by the user, use the new ID
        if (!currentEditingTemplateId && templateId !== currentEditingTemplateId) {
             // The URL needs to be POST, but data contains the user-provided ID
             // Make sure the server handles creating with a specific ID (if allowed) or ignores it on POST
             console.log("Saving new template with user-provided ID:", templateId);
        } else if (currentEditingTemplateId && templateId !== currentEditingTemplateId) {
            displayStatus("Cannot change the ID of an existing template.", true);
            // Or, implement ID change logic if desired (more complex)
            return;
        }


        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(templateData)
            });
            if (!response.ok) {
                const errorData = await response.json();
                 throw new Error(errorData.error || `Failed to save template: ${response.statusText}`);
            }
            const savedTemplate = await response.json();
            displayStatus(`Template "${savedTemplate.template_name}" saved successfully!`);
            // If it was a new template, update the state and list
            if (!currentEditingTemplateId) {
                currentEditingTemplateId = savedTemplate.template_id; // Now it's an existing template
                templateIdInput.value = savedTemplate.template_id; // Reflect saved ID if generated by server
                loadTemplateList(); // Refresh the list
                 templateSelect.value = savedTemplate.template_id; // Select the newly added one
                 deleteTemplateBtn.classList.remove('hidden'); // Allow deletion now
            } else {
                // If name changed, update dropdown text
                 const option = templateSelect.querySelector(`option[value="${currentEditingTemplateId}"]`);
                 if (option && option.textContent !== templateName) {
                     option.textContent = templateName;
                 }
            }

        } catch (error) {
            displayStatus(`Error saving template: ${error.message}`, true);
        }
    }

    async function handleDeleteTemplate() {
        if (!currentEditingTemplateId || !confirm(`Are you sure you want to delete the template "${templateNameInput.value}"? This cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/walk_map/templates/${currentEditingTemplateId}`, { method: 'DELETE' });
            if (!response.ok) {
                 if (response.status === 404) throw new Error("Template not found.");
                 const errorData = await response.json().catch(() => ({})); // Try to get error details
                 throw new Error(errorData.error || `Failed to delete template: ${response.statusText}`);
             }
            displayStatus(`Template "${templateNameInput.value}" deleted successfully.`);
            clearTemplateEditor();
            loadTemplateList(); // Refresh the list
        } catch (error) {
            displayStatus(`Error deleting template: ${error.message}`, true);
        }
    }

    function populateTemplateEditor(template) {
        templateIdInput.value = template.template_id;
        templateNameInput.value = template.template_name || '';
        templateDescriptionInput.value = template.description || '';

        const styles = template.style_data || {}; // Ensure styles object exists

        // Populate General
        const general = styles.general || {};
        generalPageBgColorInput.value = general.pageBgColor || '#f5f5f5';
        generalPrimaryTextColorInput.value = general.primaryTextColor || '#333333';
        generalPrimaryFontFamilyInput.value = general.primaryFontFamily || '';

        // Populate Header
        const header = styles.header || {};
        // ... (populate header inputs using header.headerBgColor etc. with defaults) ...
        document.getElementById('header-headerBgColor').value = header.headerBgColor || '#4CAF50';
        document.getElementById('header-headerTextColor').value = header.headerTextColor || '#FFFFFF';
        document.getElementById('header-roomInfoColor').value = header.roomInfoColor || '#FFFFFF';


        // Populate Board
        const board = styles.board || {};
        // ... (populate board inputs) ...
        document.getElementById('board-borderColor').value = board.borderColor || '#4CAF50';
        document.getElementById('board-borderWidth').value = board.borderWidth || '2px';
        document.getElementById('board-centerBgColor').value = board.centerBgColor || '#e8f5e9';
        document.getElementById('board-centerImageUrl').value = board.centerImageUrl || '';


        // Populate MapCell
        const mapCell = styles.mapCell || {};
        // ... (populate mapCell inputs) ...
        document.getElementById('mapCell-defaultBgColor').value = mapCell.defaultBgColor || '#FFFFFF';
        document.getElementById('mapCell-defaultBorderColor').value = mapCell.defaultBorderColor || '#4CAF50';
        document.getElementById('mapCell-defaultBorderWidth').value = mapCell.defaultBorderWidth || '1px';
        document.getElementById('mapCell-titleTextColor').value = mapCell.titleTextColor || '#333333';
        document.getElementById('mapCell-numberTextColor').value = mapCell.numberTextColor || '#777777';
        document.getElementById('mapCell-hoverBgColor').value = mapCell.hoverBgColor || '#e8f5e9';
        document.getElementById('mapCell-hoverBorderColor').value = mapCell.hoverBorderColor || '#3e8e41';


        // Populate PlayerMarker
        const playerMarker = styles.playerMarker || {};
        // ... (populate playerMarker inputs) ...
        document.getElementById('playerMarker-shape').value = playerMarker.shape || '50%';
        document.getElementById('playerMarker-textColor').value = playerMarker.textColor || '#FFFFFF';
        document.getElementById('playerMarker-boxShadow').value = playerMarker.boxShadow || '0 2px 4px rgba(0,0,0,0.2)';
        const playerColors = playerMarker.playerColors || [];
        playerMarkerColorInputs.forEach((input, i) => {
            input.value = playerColors[i] || '#cccccc'; // Default grey if not enough colors
        });


        // Populate Controller
        const controller = styles.controller || {};
        // ... (populate controller inputs, including nested button styles) ...
        document.getElementById('controller-panelBackground').value = controller.panelBackground || '#FFFFFF';
        document.getElementById('controller-playerLabelColor').value = controller.playerLabelColor || '#333333';
        const ctrlBtn = controller.controlButton || {};
        document.getElementById('controller-button-defaultBgColor').value = ctrlBtn.defaultBgColor || '#4CAF50';
        document.getElementById('controller-button-defaultTextColor').value = ctrlBtn.defaultTextColor || '#FFFFFF';
        document.getElementById('controller-button-borderRadius').value = ctrlBtn.borderRadius || '5px';
        document.getElementById('controller-button-hoverBgColor').value = ctrlBtn.hoverBgColor || '#3e8e41';
        document.getElementById('controller-button-cooldownOpacity').value = ctrlBtn.cooldownOpacity || '0.6';


        // Populate Info Area
        const info = styles.info || {};
         // ... (populate info inputs, including nested leave button styles) ...
        document.getElementById('info-panelBackground').value = info.panelBackground || '#FFFFFF';
        document.getElementById('info-sectionTitleColor').value = info.sectionTitleColor || '#333333';
        document.getElementById('info-playerListText').value = info.playerListText || '#333333';
        document.getElementById('info-staticTextColor').value = info.staticTextColor || '#333333';
        const leaveBtn = info.leaveButton || {};
        document.getElementById('info-leaveButton-defaultBgColor').value = leaveBtn.defaultBgColor || '#f1f1f1';
        document.getElementById('info-leaveButton-defaultTextColor').value = leaveBtn.defaultTextColor || '#333333';


        // Populate Connection Status
        const connection = styles.connection || {};
        // ... (populate connection inputs) ...
         document.getElementById('connection-onlineBgColor').value = connection.onlineBgColor || '#dff0d8';
         document.getElementById('connection-onlineTextColor').value = connection.onlineTextColor || '#3c763d';
         document.getElementById('connection-offlineBgColor').value = connection.offlineBgColor || '#f2dede';
         document.getElementById('connection-offlineTextColor').value = connection.offlineTextColor || '#a94442';
         document.getElementById('connection-connectingBgColor').value = connection.connectingBgColor || '#fcf8e3';
         document.getElementById('connection-connectingTextColor').value = connection.connectingTextColor || '#8a6d3b';


        // Populate Modal
        const modal = styles.modal || {};
        // ... (populate modal inputs) ...
        document.getElementById('modal-overlayBgColor').value = modal.overlayBgColor || 'rgba(0, 0, 0, 0.7)';
        document.getElementById('modal-contentBgColor').value = modal.contentBgColor || '#FFFFFF';
        modalHeaderBgColorInput_Template.value = modal.headerBgColor || '#4CAF50'; // Template default
        document.getElementById('modal-headerTextColor').value = modal.headerTextColor || '#FFFFFF';
        document.getElementById('modal-bodyTextColor').value = modal.bodyTextColor || '#333333';

    }

     function collectStyleData() {
        // Collect data from all input fields and structure into the JSON format
        const playerColors = playerMarkerColorInputs.map(input => input.value).filter(color => color); // Collect non-empty colors

        return {
            general: {
                pageBgColor: generalPageBgColorInput.value,
                primaryTextColor: generalPrimaryTextColorInput.value,
                primaryFontFamily: generalPrimaryFontFamilyInput.value.trim() || null,
            },
            header: {
                headerBgColor: document.getElementById('header-headerBgColor').value,
                headerTextColor: document.getElementById('header-headerTextColor').value,
                roomInfoColor: document.getElementById('header-roomInfoColor').value,
            },
            board: {
                 borderColor: document.getElementById('board-borderColor').value,
                 borderWidth: document.getElementById('board-borderWidth').value.trim() || null,
                 centerBgColor: document.getElementById('board-centerBgColor').value,
                 centerImageUrl: document.getElementById('board-centerImageUrl').value.trim() || null,
            },
            mapCell: {
                 defaultBgColor: document.getElementById('mapCell-defaultBgColor').value,
                 defaultBorderColor: document.getElementById('mapCell-defaultBorderColor').value,
                 defaultBorderWidth: document.getElementById('mapCell-defaultBorderWidth').value.trim() || null,
                 titleTextColor: document.getElementById('mapCell-titleTextColor').value,
                 numberTextColor: document.getElementById('mapCell-numberTextColor').value,
                 hoverBgColor: document.getElementById('mapCell-hoverBgColor').value,
                 hoverBorderColor: document.getElementById('mapCell-hoverBorderColor').value,
            },
            playerMarker: {
                shape: document.getElementById('playerMarker-shape').value.trim() || null,
                textColor: document.getElementById('playerMarker-textColor').value,
                boxShadow: document.getElementById('playerMarker-boxShadow').value.trim() || null,
                playerColors: playerColors,
            },
            controller: {
                panelBackground: document.getElementById('controller-panelBackground').value,
                playerLabelColor: document.getElementById('controller-playerLabelColor').value,
                controlButton: {
                     defaultBgColor: document.getElementById('controller-button-defaultBgColor').value,
                     defaultTextColor: document.getElementById('controller-button-defaultTextColor').value,
                     borderRadius: document.getElementById('controller-button-borderRadius').value.trim() || null,
                     hoverBgColor: document.getElementById('controller-button-hoverBgColor').value,
                     cooldownOpacity: document.getElementById('controller-button-cooldownOpacity').value.trim() || null,
                }
            },
            info: {
                panelBackground: document.getElementById('info-panelBackground').value,
                sectionTitleColor: document.getElementById('info-sectionTitleColor').value,
                playerListText: document.getElementById('info-playerListText').value,
                staticTextColor: document.getElementById('info-staticTextColor').value,
                leaveButton: {
                    defaultBgColor: document.getElementById('info-leaveButton-defaultBgColor').value,
                    defaultTextColor: document.getElementById('info-leaveButton-defaultTextColor').value,
                }
            },
            connection: {
                 onlineBgColor: document.getElementById('connection-onlineBgColor').value,
                 onlineTextColor: document.getElementById('connection-onlineTextColor').value,
                 offlineBgColor: document.getElementById('connection-offlineBgColor').value,
                 offlineTextColor: document.getElementById('connection-offlineTextColor').value,
                 connectingBgColor: document.getElementById('connection-connectingBgColor').value,
                 connectingTextColor: document.getElementById('connection-connectingTextColor').value,
            },
            modal: {
                 overlayBgColor: document.getElementById('modal-overlayBgColor').value.trim() || null,
                 contentBgColor: document.getElementById('modal-contentBgColor').value,
                 headerBgColor: modalHeaderBgColorInput_Template.value, // Template default
                 headerTextColor: document.getElementById('modal-headerTextColor').value,
                 bodyTextColor: document.getElementById('modal-bodyTextColor').value,
            }
            // ... (Collect data for all other sections)
        };
    }


    function clearTemplateEditor() {
        templateIdInput.value = '';
        templateNameInput.value = '';
        templateDescriptionInput.value = '';
        // Reset all input fields to their default values (or empty)
        // This needs to reset ALL the inputs collected in collectStyleData()
        // Example for one section:
        generalPageBgColorInput.value = '#f5f5f5';
        generalPrimaryTextColorInput.value = '#333333';
        generalPrimaryFontFamilyInput.value = '';
        // ... Reset ALL other inputs ...
        playerMarkerColorInputs.forEach(input => input.value = '#cccccc');
        modalHeaderBgColorInput_Template.value = '#4CAF50'; // Reset template default

        templateEditor.classList.add('hidden');
        deleteTemplateBtn.classList.add('hidden');
        currentEditingTemplateId = null;
         templateSelect.value = ""; // Reset dropdown selection
    }

    function generateTemplateId() {
         // Simple suggestion, replace spaces with underscores, lowercase
         const name = templateNameInput.value.trim() || "new_template";
         return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    }


    // --- Map Cell Functions ---
    async function loadCellDataAndRenderAdminGrid() {
        try {
            const response = await fetch('/api/admin/walk_map/cells');
            if (!response.ok) throw new Error(`Failed to fetch cell data: ${response.statusText}`);
            currentCellInfo = await response.json();
            renderAdminGrid(); // Call the rendering function
            cellDataChanged = false; // Reset change flag
             displayStatus("Map cell data loaded.");
        } catch (error) {
            displayStatus(`Error loading cell data: ${error.message}`, true);
             // Initialize with empty array if load fails to prevent errors
             currentCellInfo = Array(24).fill({}).map((_, i) => ({
                cell_index: i,
                title: `Error ${i}`,
                description: 'Failed to load',
                cell_bg_color: null,
                modal_header_bg_color: null
             }));
             renderAdminGrid(); // Render with error state
        }
    }

    function renderAdminGrid() {
        adminMapGrid.innerHTML = ''; // Clear previous grid
        const totalCells = 24; // Or get from config if dynamic

        for (let i = 0; i < totalCells; i++) {
            const cellData = currentCellInfo.find(c => c.cell_index === i) || { title: `未定義 ${i}`, cell_bg_color: null };

            const cellDiv = document.createElement('div');
            cellDiv.className = 'admin-map-cell';
            cellDiv.id = `admin-cell-${i}`;
            cellDiv.dataset.cellIndex = i;

            const titleSpan = document.createElement('span');
            titleSpan.className = 'admin-cell-title';
            titleSpan.textContent = cellData.title || '(無標題)';

            const indexSpan = document.createElement('span');
            indexSpan.className = 'admin-cell-index';
            indexSpan.textContent = i;


            cellDiv.appendChild(titleSpan);
             cellDiv.appendChild(indexSpan);

            // Apply specific background color if defined, otherwise rely on CSS default
            cellDiv.style.backgroundColor = cellData.cell_bg_color || ''; // Empty string resets to CSS default

            cellDiv.addEventListener('click', () => {
                openCellEditModal(i);
            });

            adminMapGrid.appendChild(cellDiv);
        }
        // Apply CSS Grid positioning via classes (preferred) or JS if needed
        applyGridPositioningCSS();
    }

    function applyGridPositioningCSS() {
        // Add classes based on index to apply grid-area from CSS
         const cells = adminMapGrid.querySelectorAll('.admin-map-cell');
         cells.forEach(cell => {
            const i = parseInt(cell.dataset.cellIndex);
             // Logic similar to game.js createMonopolyMap, but for admin grid
            if (i >= 0 && i <= 6) cell.style.gridArea = `${1} / ${i + 1} / ${2} / ${i + 2}`;
            else if (i >= 7 && i <= 12) cell.style.gridArea = `${i - 7 + 2} / ${7} / ${i - 7 + 3} / ${8}`;
            else if (i >= 13 && i <= 18) cell.style.gridArea = `${7} / ${7 - (i - 13)} / ${8} / ${7 - (i - 13) + 1}`;
            else if (i >= 19 && i <= 23) cell.style.gridArea = `${7 - (i - 19)} / ${1} / ${7 - (i - 19) + 1} / ${2}`;
         });
         console.log("Applied grid positioning to admin map.");
    }

    function openCellEditModal(index) {
        const cellData = currentCellInfo.find(c => c.cell_index === index);
        if (!cellData) {
            displayStatus(`Cannot find data for cell index ${index}`, true);
            return;
        }

        modalCellIndexDisplay.textContent = index;
        editingCellIndexInput.value = index;
        modalCellTitleInput.value = cellData.title || '';
        modalCellDescTextarea.value = cellData.description || '';

        // Reset color input "cleared" state and set value
        modalCellBgColorInput.value = cellData.cell_bg_color || '#ffffff'; // Default to white if null
        modalCellBgColorInput.dataset.cleared = 'false';
        modalModalHeaderBgColorInput.value = cellData.modal_header_bg_color || '#ffffff'; // Default to white if null
        modalModalHeaderBgColorInput.dataset.cleared = 'false';


        cellEditModal.classList.remove('hidden');
    }

    function saveModalChangesToLocal() {
        const index = parseInt(editingCellIndexInput.value, 10);
        const cellData = currentCellInfo.find(c => c.cell_index === index);
        if (isNaN(index) || !cellData) {
            displayStatus("Error: Invalid cell index for saving.", true);
            return;
        }

        const newTitle = modalCellTitleInput.value.trim();
        const newDesc = modalCellDescTextarea.value.trim();

        // Handle color clearing: if marked as cleared or set to white (visual reset), save as null
        let newBgColor = modalCellBgColorInput.value;
        if (modalCellBgColorInput.dataset.cleared === 'true' || newBgColor === '#ffffff') {
            newBgColor = null;
        }
        let newModalHeaderBgColor = modalModalHeaderBgColorInput.value;
         if (modalModalHeaderBgColorInput.dataset.cleared === 'true' || newModalHeaderBgColor === '#ffffff') {
            newModalHeaderBgColor = null;
        }


        // Update the local array
        cellData.title = newTitle;
        cellData.description = newDesc;
        cellData.cell_bg_color = newBgColor;
        cellData.modal_header_bg_color = newModalHeaderBgColor;

        // Update the visual grid preview immediately
        const adminCellDiv = document.getElementById(`admin-cell-${index}`);
        if (adminCellDiv) {
            const titleSpan = adminCellDiv.querySelector('.admin-cell-title');
            if (titleSpan) titleSpan.textContent = newTitle || '(無標題)';
            adminCellDiv.style.backgroundColor = newBgColor || ''; // Reset to CSS default if null
        }

        cellDataChanged = true; // Mark changes as pending save
        closeCellEditModal();
        displayStatus(`Cell ${index} changes temporarily saved. Click "Save All Cell Changes" to commit.`);
    }

    async function saveAllCellDataToBackend() {
        if (!cellDataChanged) {
             displayStatus("No cell changes to save.");
             return;
         }

        try {
            const response = await fetch('/api/admin/walk_map/cells', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentCellInfo) // Send the entire array
            });
            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error || `Failed to save cell data: ${response.statusText}`);
             }
            // const result = await response.json(); // Optional: check result if needed
            cellDataChanged = false; // Reset flag after successful save
            displayStatus("All cell changes saved successfully!");
        } catch (error) {
            displayStatus(`Error saving cell data: ${error.message}`, true);
        }
    }

    // --- Utility Functions ---
    function displayStatus(message, isError = false) {
        statusMessage.textContent = message;
        statusMessage.className = isError ? 'status-error' : 'status-success';
        // Auto-clear message after a few seconds
        setTimeout(() => {
            if (statusMessage.textContent === message) { // Only clear if message hasn't changed
                 statusMessage.textContent = '';
                 statusMessage.className = '';
            }
        }, 5000);
    }

     // Add window.closeCellEditModal for the inline onclick
     window.closeCellEditModal = closeCellEditModal;
     window.clearColorInput = (inputId) => {
         const input = document.getElementById(inputId);
         input.value = '#ffffff'; // Visually reset to white
         input.dataset.cleared = 'true'; // Mark as cleared for saving logic
     };

}); // End DOMContentLoaded