    // --- Edit Banner Form Submission Listener ---
    if (editForm) {
        editForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            editFormError.textContent = '';
            const bannerId = editBannerId.value;
            if (!bannerId) { editFormError.textContent = '錯誤：找不到 Banner ID。'; return; }

            const displayOrderInput = editBannerDisplayOrder.value.trim();
            const displayOrder = displayOrderInput === '' ? 0 : parseInt(displayOrderInput);
            if (isNaN(displayOrder)) { editFormError.textContent = '排序必須是有效的數字。'; return; }

            // *** Log the selected value BEFORE creating the data object ***
            console.log("Edit form - Page Location selected value:", editBannerPageLocation.value);

            const updatedData = {
                 image_url: editBannerImageUrl.value.trim(),
                 link_url: editBannerLinkUrl.value.trim() || null,
                 display_order: displayOrder,
                 alt_text: editBannerAltText.value.trim() || null,
                 page_location: editBannerPageLocation.value // Ensure this line exists and uses the correct variable
            };
            // *** Log the data being sent ***
            console.log("準備更新 Banner:", bannerId, JSON.stringify(updatedData, null, 2));

            if (!updatedData.image_url) { editFormError.textContent = '圖片網址不能為空。'; return; }
            if (!updatedData.page_location) { editFormError.textContent = '請選擇顯示頁面。'; return; }

            try {
                const response = await fetch(`/api/admin/banners/${bannerId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedData) // Send the stringified data
                });
                if (!response.ok) {
                    let errorMsg = `儲存失敗 (HTTP ${response.status})`;
                     try { const errorData = await response.json(); errorMsg = `${errorMsg}: ${errorData.error || 'No error message provided.'}`; } catch (e) {}
                     throw new Error(errorMsg);
                }
                console.log("Banner 更新成功，關閉 Modal 並刷新列表。");
                closeEditBannerModal();
                await fetchAndDisplayBanners();
            } catch (error) {
                console.error("更新 Banner 時發生錯誤:", error);
                editFormError.textContent = `儲存錯誤：${error.message}`;
            }
        });
    } else {
        console.error("編輯 Banner 表單元素未找到。");
    }

    // --- Add Banner Form Submission Listener ---
    if (addForm) {
        addForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            addFormError.textContent = '';

            const displayOrderInput = addBannerDisplayOrder.value.trim();
            const displayOrder = displayOrderInput === '' ? 0 : parseInt(displayOrderInput);
            if (isNaN(displayOrder)) { addFormError.textContent = '排序必須是有效的數字。'; return; }

            // *** Log the selected value BEFORE creating the data object ***
            console.log("Add form - Page Location selected value:", addBannerPageLocation.value);

            const newBannerData = {
                image_url: addBannerImageUrl.value.trim(),
                link_url: addBannerLinkUrl.value.trim() || null,
                display_order: displayOrder,
                alt_text: addBannerAltText.value.trim() || null,
                page_location: addBannerPageLocation.value // Ensure this line exists and uses the correct variable
            };
            // *** Log the data being sent ***
            console.log("準備新增 Banner:", JSON.stringify(newBannerData, null, 2));

             if (!newBannerData.image_url) { addFormError.textContent = '圖片網址不能為空。'; return; }
             if (!newBannerData.page_location) { addFormError.textContent = '請選擇顯示頁面。'; return; }

            try {
                const response = await fetch(`/api/admin/banners`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newBannerData) // Send the stringified data
                });
                if (!response.ok) {
                    let errorMsg = `新增失敗 (HTTP ${response.status})`;
                    try { const errorData = await response.json(); errorMsg = `${errorMsg}: ${errorData.error || 'No error message provided.'}`; } catch (e) {}
                    throw new Error(errorMsg);
                }
                console.log("Banner 新增成功，關閉 Modal 並刷新列表。");
                closeAddBannerModal();
                await fetchAndDisplayBanners();
            } catch (error) {
                 console.error("新增 Banner 時發生錯誤:", error);
                addFormError.textContent = `新增錯誤：${error.message}`;
            }
        });
    } else {
        console.error("新增 Banner 表單元素未找到。");
    }