document.addEventListener('DOMContentLoaded', () => {
    // 初始化輪播圖
    const warehouseBannerSwiper = new Swiper('#warehouse-banner-carousel', {
        loop: true,
        pagination: {
            el: '.swiper-pagination',
            clickable: true
        },
        navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev'
        },
        autoplay: {
            delay: 5000,
            disableOnInteraction: false
        }
    });

    // 載入倉庫頁輪播圖
    fetch('/api/banners?page=warehouse')
        .then(response => response.json())
        .then(banners => {
            if (banners.length === 0) {
                console.log('No banners found for warehouse page');
                return;
            }

            // 清空現有輪播圖
            const swiperWrapper = document.querySelector('#warehouse-banner-carousel .swiper-wrapper');
            swiperWrapper.innerHTML = '';

            // 動態添加輪播圖
            banners.forEach(banner => {
                const slide = document.createElement('div');
                slide.classList.add('swiper-slide');
                
                const img = document.createElement('img');
                img.src = banner.image_url;
                img.alt = banner.alt_text || 'SunnyYummy 倉庫';
                
                // 如果有連結，則添加可點擊功能
                if (banner.link_url) {
                    const link = document.createElement('a');
                    link.href = banner.link_url;
                    link.appendChild(img);
                    slide.appendChild(link);
                } else {
                    slide.appendChild(img);
                }

                swiperWrapper.appendChild(slide);
            });

            // 重新初始化輪播圖
            warehouseBannerSwiper.destroy();
            new Swiper('#warehouse-banner-carousel', {
                loop: true,
                pagination: {
                    el: '.swiper-pagination',
                    clickable: true
                },
                navigation: {
                    nextEl: '.swiper-button-next',
                    prevEl: '.swiper-button-prev'
                },
                autoplay: {
                    delay: 5000,
                    disableOnInteraction: false
                }
            });
        })
        .catch(error => {
            console.error('Error fetching warehouse banners:', error);
        });
}); 