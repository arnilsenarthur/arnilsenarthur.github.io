import * as THREE from 'https://unpkg.com/three@0.169.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.169.0/examples/jsm/loaders/GLTFLoader.js';

export function init3DTimeline(timelineData) {
    const container = document.getElementById('timeline-canvas-container');
    const scrollContainer = document.querySelector('.canvas');

    if (!container || !scrollContainer) {
        console.error("Timeline containers not found");
        return null;
    }

    if (!timelineData || !Array.isArray(timelineData)) {
        console.error("Invalid timeline data");
        container.innerHTML = "Error loading timeline data.";
        return null;
    }

    try {
        container.innerHTML = ''; 
        const loaderOverlay = document.createElement('div');
        loaderOverlay.className = 'timeline-loader';
        loaderOverlay.innerHTML = `<div class="timeline-loader-inner"><div class="timeline-loader-text">Loading...</div><div class="timeline-loader-bar" aria-hidden="true"><div class="timeline-loader-bar-fill"></div></div><div class="timeline-loader-percent" aria-hidden="true">0%</div></div>`;
        container.appendChild(loaderOverlay);
        const loaderBarFill = loaderOverlay.querySelector('.timeline-loader-bar-fill');
        const loaderPercentEl = loaderOverlay.querySelector('.timeline-loader-percent');
        let totalAssetsStarted = 0;
        const clamp01 = (v) => Math.max(0, Math.min(1, v));
        const updateLoaderProgress = () => {
            if (!loaderBarFill) return;
            const progress = totalAssetsStarted > 0 ? (totalAssetsStarted - pendingAssets) / totalAssetsStarted : 0;
            const clamped = clamp01(progress);
            loaderBarFill.style.transform = `scaleX(${clamped})`;
            if (loaderPercentEl) loaderPercentEl.textContent = `${Math.floor(clamped * 100)}%`;
        };

        let hintOverlay = null;
        let hintTextEl = null;
        let hintDefaultText = '';
        let hintHideTimer = 0;
        let hintSuppressAutoHideUntil = 0;
        let didUserInteract = false;
        const markUserInteraction = () => {
            if (didUserInteract) return;
            const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
            if (now < hintSuppressAutoHideUntil) return;
            didUserInteract = true;
            if (hintOverlay) hintOverlay.classList.add('is-hidden');
        };

        const initialSeed = Date.now() % 10000;
        let seed = initialSeed;

        const keys = { w: false, a: false, s: false, d: false, arrowup: false, arrowdown: false, arrowleft: false, arrowright: false };
        let isManualControl = false;
        let manualEntryArmed = true;
        let manualNeedsGroundSnap = false;
        let manualPosition = new THREE.Vector3();
        let manualRotation = 0; 
        let manualSteerAngle = 0;
        let carSpeed = 0;
        const maxSpeed = 1.0;
        const acceleration = 0.02;
        const friction = 0.95;
        let manualVelocity = new THREE.Vector3();
        let onGround = false;
        let groundNormalSmoothed = new THREE.Vector3(0, 1, 0);
        const gravity = 0.4;
        let manualRoadT = 0;
        let manualStartLimitHasPos = false;
        let manualStartLimitActive = false;
        const manualStartLimitPos = new THREE.Vector3();
        const manualStartLimitForward = new THREE.Vector3(0, 0, -1);
        const chassisSkinWidth = 0.25;
        
        const raycaster = new THREE.Raycaster();
        const downVector = new THREE.Vector3(0, -1, 0);
        const tmpRayOrigin = new THREE.Vector3();
        const tmpWorldNormal = new THREE.Vector3();
        const tmpRoadCenter = new THREE.Vector3();
        const tmpRoadTangent = new THREE.Vector3();
        const tmpRoadForward = new THREE.Vector3();
        const tmpRoadSide = new THREE.Vector3();
        const tmpRoadDelta = new THREE.Vector3();
        const tmpStartDelta = new THREE.Vector3();
        const tmpVegCenter = new THREE.Vector3();
        const tmpVegTangent = new THREE.Vector3();
        const tmpVegSide = new THREE.Vector3();
        const tmpVegCarPos = new THREE.Vector3();
        const tmpForwardDir = new THREE.Vector3();
        const tmpVelDir = new THREE.Vector3();
        const tmpDesiredDir = new THREE.Vector3();
        const tmpStreetForward = new THREE.Vector3();
        const streetForwardSmoothed = new THREE.Vector3(0, 0, -1);

        const seededRandom = () => {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };

        const createPool = ({ create, onAcquire, onRelease, initialSize = 0 }) => {
            const free = [];
            for (let i = 0; i < initialSize; i++) {
                const item = create();
                if (!item) continue;
                if (onRelease) onRelease(item);
                free.push(item);
            }
            return {
                acquire: () => {
                    const item = free.pop() ?? create();
                    if (!item) return null;
                    if (onAcquire) onAcquire(item);
                    return item;
                },
                release: (item) => {
                    if (!item) return;
                    if (onRelease) onRelease(item);
                    free.push(item);
                }
            };
        };

        const scene = new THREE.Scene();
        const initialWidth = Math.max(1, container.clientWidth);
        const initialHeight = Math.max(1, container.clientHeight);
        const camera = new THREE.PerspectiveCamera(60, initialWidth / initialHeight, 0.1, 1000);

        const isSmallScreen = window.matchMedia('(max-width: 768px)').matches;
        const renderer = new THREE.WebGLRenderer({ antialias: !isSmallScreen, alpha: true, powerPreference: 'high-performance' });
        renderer.setSize(initialWidth, initialHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmallScreen ? 1.5 : 2));
        renderer.domElement.style.opacity = '0';
        renderer.domElement.style.transition = 'opacity 600ms ease';
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.top = '0';
        renderer.domElement.style.left = '0';
        container.appendChild(renderer.domElement);

        let destroyed = false;
        let rafId = 0;
        let didReveal = false;
        let pendingAssets = 0;
        let loadingBegan = false;
        let revealFallbackTimer = 0;

        const updateRendererSize = () => {
            const width = container.clientWidth;
            const height = container.clientHeight;
            if (width <= 0 || height <= 0) return false;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmallScreen ? 1.5 : 2));
            return true;
        };

        const revealCanvas = () => {
            if (destroyed || didReveal) return;
            didReveal = true;
            if (revealFallbackTimer) {
                clearTimeout(revealFallbackTimer);
                revealFallbackTimer = 0;
            }
            requestAnimationFrame(() => {
                if (destroyed) return;
                updateRendererSize();
                renderer.domElement.style.opacity = '1';
                if (loaderBarFill) loaderBarFill.style.transform = 'scaleX(1)';
                if (loaderPercentEl) loaderPercentEl.textContent = '100%';
                loaderOverlay.style.opacity = '0';
                setTimeout(() => {
                    if (destroyed) return;
                    if (loaderOverlay.parentNode) loaderOverlay.parentNode.removeChild(loaderOverlay);
                }, 350);
                syncUiMode();
                if (hintOverlay && !didUserInteract) hintOverlay.classList.remove('is-hidden');
            });
        };

        const revealWhenReady = () => {
            if (destroyed || didReveal) return;
            if (!updateRendererSize()) {
                requestAnimationFrame(revealWhenReady);
                return;
            }
            revealCanvas();
        };

        const startAsset = () => {
            loadingBegan = true;
            pendingAssets++;
            totalAssetsStarted++;
            updateLoaderProgress();
            let done = false;
            return () => {
                if (done) return;
                done = true;
                pendingAssets = Math.max(0, pendingAssets - 1);
                updateLoaderProgress();
                if (loadingBegan && pendingAssets === 0) revealWhenReady();
            };
        };
        revealFallbackTimer = window.setTimeout(() => {
            revealWhenReady();
        }, 4000);

        const onKeyDown = (e) => {
            const k = e.key.toLowerCase();
            if (keys.hasOwnProperty(k)) {
                keys[k] = true;
                markUserInteraction();
                e.preventDefault();
            }
        };
        const onKeyUp = (e) => {
            const k = e.key.toLowerCase();
            if (keys.hasOwnProperty(k)) {
                keys[k] = false;
                e.preventDefault();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        scene.add(camera);

        const points = [];
        const spacing = 80; 
        
        let currentPos = new THREE.Vector3(0, 0, 10);
        points.push(currentPos.clone());

        const totalItems = timelineData.length;
        const extraPoints = 10; 
        const totalPoints = totalItems + extraPoints;
        const maxT = (totalItems) / (totalPoints - 1);

        const uiRoot = document.createElement('div');
        uiRoot.className = 'timeline-ui-overlay';
        container.parentNode?.appendChild(uiRoot);

        const dragOverlay = document.createElement('div');
        dragOverlay.className = 'timeline-drag-layer';
        uiRoot.appendChild(dragOverlay);

        const progressOverlay = document.createElement('div');
        progressOverlay.className = 'timeline-progress is-hidden';
        const progressViewport = document.createElement('div');
        progressViewport.className = 'timeline-progress-viewport';
        const progressInner = document.createElement('div');
        progressInner.className = 'timeline-progress-inner';
        const progressTrack = document.createElement('div');
        progressTrack.className = 'timeline-progress-track';
        const progressFill = document.createElement('div');
        progressFill.className = 'timeline-progress-fill';
        progressTrack.appendChild(progressFill);

        const progressMarkers = document.createElement('div');
        progressMarkers.className = 'timeline-progress-markers';
        progressInner.appendChild(progressTrack);
        progressInner.appendChild(progressMarkers);
        progressViewport.appendChild(progressInner);
        progressOverlay.appendChild(progressViewport);
        uiRoot.appendChild(progressOverlay);

        const endlessHud = document.createElement('div');
        endlessHud.className = 'timeline-endless-hud is-hidden';
        endlessHud.innerHTML = `<div class="timeline-endless-pill timeline-endless-lives" aria-label="Lives"><img class="timeline-endless-heart" src="/img/heart.png" alt=""><img class="timeline-endless-heart" src="/img/heart.png" alt=""><img class="timeline-endless-heart" src="/img/heart.png" alt=""></div><div class="timeline-endless-pill timeline-endless-distance"><span class="timeline-endless-distance-value">0m</span></div>`;
        uiRoot.appendChild(endlessHud);
        const endlessDistanceValueEl = endlessHud.querySelector('.timeline-endless-distance-value');
        const heartEls = Array.from(endlessHud.querySelectorAll('.timeline-endless-heart'));
        let endlessLives = 3;
        const renderEndlessLives = () => {
            for (let i = 0; i < heartEls.length; i++) {
                if (i < endlessLives) heartEls[i].classList.remove('is-dead');
                else heartEls[i].classList.add('is-dead');
            }
        };
        renderEndlessLives();

        const showProgressOverlay = () => {
            progressOverlay.classList.remove('is-hidden');
        };
        const hideProgressOverlay = () => {
            progressOverlay.classList.add('is-hidden');
        };
        const showEndlessHud = () => {
            endlessHud.classList.remove('is-hidden');
        };
        const hideEndlessHud = () => {
            endlessHud.classList.add('is-hidden');
        };

        hintOverlay = document.createElement('div');
        hintOverlay.className = 'timeline-hint is-hidden';
        hintOverlay.innerHTML = `<div class="timeline-hint-text">Scroll to auto-move • WASD to steer</div><div class="timeline-hint-swipe" aria-hidden="true"><div class="timeline-hint-swipe-track"></div><div class="timeline-hint-swipe-hand"><svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false"><path d="M7 12V7.5a1.5 1.5 0 0 1 3 0V11h1V6.5a1.5 1.5 0 0 1 3 0V11h1V7.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 6.5-6.5 6.5H12c-3.7 0-5.5-2.6-5.5-5.5V12a1.5 1.5 0 0 1 3 0v2h-1.5V12"/></svg></div></div>`;
        if (didUserInteract) hintOverlay.classList.add('is-hidden');
        uiRoot.appendChild(hintOverlay);
        hintTextEl = hintOverlay.querySelector('.timeline-hint-text');
        hintDefaultText = hintTextEl?.textContent ?? '';

        const showHintTemporarily = (text, durationMs = 2000) => {
            if (!hintOverlay || !hintTextEl) return;
            if (hintHideTimer) {
                clearTimeout(hintHideTimer);
                hintHideTimer = 0;
            }
            const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
            hintSuppressAutoHideUntil = now + durationMs;
            hintTextEl.textContent = text;
            hintOverlay.classList.remove('is-hidden');
            hintHideTimer = window.setTimeout(() => {
                hintHideTimer = 0;
                hintSuppressAutoHideUntil = 0;
                if (!hintOverlay || !hintTextEl) return;

                window.setTimeout(() => {
                    hintTextEl.textContent = hintDefaultText;
                }, 500);
                if (didUserInteract || isEndlessRunner) hintOverlay.classList.add('is-hidden');
            }, durationMs);
        };

        const infoOverlay = document.createElement('div');
        infoOverlay.className = 'timeline-marker-info is-hidden';
        infoOverlay.innerHTML = `<div class="timeline-marker-info-inner"><div class="timeline-marker-info-date"></div><div class="timeline-marker-info-title"></div><div class="timeline-marker-info-desc"></div></div>`;
        uiRoot.appendChild(infoOverlay);
        const infoDateEl = infoOverlay.querySelector('.timeline-marker-info-date');
        const infoTitleEl = infoOverlay.querySelector('.timeline-marker-info-title');
        const infoDescEl = infoOverlay.querySelector('.timeline-marker-info-desc');
        let activeInfoIndex = -1;
        const markerInfo = [];
        let infoAnimTimer = 0;
        const setActiveInfo = (index) => {
            if (index == null || index < 0 || index >= markerInfo.length) {
                activeInfoIndex = -1;
                infoOverlay.classList.add('is-hidden');
                infoOverlay.classList.remove('is-animating');
                if (infoAnimTimer) {
                    clearTimeout(infoAnimTimer);
                    infoAnimTimer = 0;
                }
                return;
            }
            if (activeInfoIndex === index) return;
            activeInfoIndex = index;
            const info = markerInfo[index];
            if (infoDateEl) infoDateEl.textContent = info.date;
            if (infoTitleEl) infoTitleEl.textContent = info.title;
            if (infoDescEl) infoDescEl.textContent = info.desc;
            infoOverlay.classList.remove('is-hidden');
            infoOverlay.classList.remove('is-animating');
            void infoOverlay.offsetWidth;
            infoOverlay.classList.add('is-animating');
            if (infoAnimTimer) clearTimeout(infoAnimTimer);
            infoAnimTimer = window.setTimeout(() => {
                infoAnimTimer = 0;
                infoOverlay.classList.remove('is-animating');
            }, 280);
        };

        const markerEls = [];
        const scrollToFraction = (fraction) => {
            const scrollHeight = scrollContainer.scrollHeight - scrollContainer.clientHeight;
            const top = Math.max(0, Math.min(scrollHeight, fraction * scrollHeight));
            try {
                scrollContainer.scrollTo({ top, behavior: 'smooth' });
            } catch {
                scrollContainer.scrollTop = top;
            }
            updateScroll();
        };

        const updateProgressInnerLayout = () => {
            const viewportWidth = progressViewport.clientWidth || 0;
            const desiredInnerWidth = Math.max(viewportWidth, 120 + totalItems * 90);
            progressInner.style.width = `${desiredInnerWidth}px`;
        };

        let isDraggingScroll = false;
        let dragPointerId = null;
        let dragStartY = 0;
        let dragStartScrollTop = 0;

        const onDragPointerDown = (e) => {
            if (!e.isPrimary) return;
            markUserInteraction();
            isDraggingScroll = true;
            dragPointerId = e.pointerId;
            dragStartY = e.clientY;
            dragStartScrollTop = scrollContainer.scrollTop;
            dragOverlay.setPointerCapture(e.pointerId);
            e.preventDefault();
        };

        const onDragPointerMove = (e) => {
            if (!isDraggingScroll || e.pointerId !== dragPointerId) return;
            const dy = e.clientY - dragStartY;
            scrollContainer.scrollTop = dragStartScrollTop - dy * 3;
            e.preventDefault();
        };

        const endDrag = (e) => {
            if (!isDraggingScroll || e.pointerId !== dragPointerId) return;
            isDraggingScroll = false;
            dragPointerId = null;
            e.preventDefault();
        };

        const onDragWheel = (e) => {
            if (isDraggingScroll) return;
            markUserInteraction();
            let dy = e.deltaY;
            if (e.deltaMode === 1) dy *= 16;
            else if (e.deltaMode === 2) dy *= window.innerHeight;
            scrollContainer.scrollTop += dy;
            e.preventDefault();
        };

        dragOverlay.addEventListener('pointerdown', onDragPointerDown);
        dragOverlay.addEventListener('pointermove', onDragPointerMove);
        dragOverlay.addEventListener('pointerup', endDrag);
        dragOverlay.addEventListener('pointercancel', endDrag);
        dragOverlay.addEventListener('wheel', onDragWheel, { passive: false });

        for (let i = 0; i < totalItems; i++) {
            const markerWrap = document.createElement('div');
            markerWrap.className = 'timeline-progress-marker-wrap';
            const marker = document.createElement('div');
            marker.className = 'timeline-progress-marker';
            marker.style.setProperty('--scale', '1');
            const label = document.createElement('div');
            label.className = 'timeline-progress-label';
            label.textContent = String(timelineData[i]?.date ?? '');
            markerWrap.appendChild(marker);
            markerWrap.appendChild(label);
            progressMarkers.appendChild(markerWrap);
            const pointIndex = i + 1;
            const t = pointIndex / (totalItems + extraPoints);
            const pos = maxT > 1e-8 ? THREE.MathUtils.clamp(t / maxT, 0, 1) : 0;
            markerWrap.style.setProperty('--pos', String(pos));
            markerWrap.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                markUserInteraction();
                if (isEndlessRunner) {
                    setEndlessRunnerMode(false);
                }
                isManualControl = false;
                manualEntryArmed = true;
                let desiredPos = pos;
                try {
                    const len = curve.getLength();
                    const tAhead = len > 1e-6 ? (distanceAhead / len) : 0;
                    const desiredT = THREE.MathUtils.clamp(t - tAhead, 0, maxT);
                    desiredPos = maxT > 1e-8 ? THREE.MathUtils.clamp(desiredT / maxT, 0, 1) : 0;
                } catch {}
                scrollToFraction(desiredPos);
            });
            markerEls.push({ marker, label, pos });
        }
        queueMicrotask(updateProgressInnerLayout);

        let isEndlessRunner = false;
        const syncUiMode = () => {
            if (!didReveal) return;
            if (isEndlessRunner) {
                hideProgressOverlay();
                if (hintOverlay) hintOverlay.classList.add('is-hidden');
                showEndlessHud();
            } else {
                showProgressOverlay();
                hideEndlessHud();
            }
        };
        const setEndlessRunnerMode = (next) => {
            const v = !!next;
            if (v === isEndlessRunner) return;
            isEndlessRunner = v;
            syncUiMode();
        };
        const hudStartPos = new THREE.Vector3();
        let hudHasStartPos = false;
        const updateHudDistance = () => {
            if (!endlessDistanceValueEl || !carModel) return;
            if (!hudHasStartPos) {
                hudStartPos.copy(carModel.position);
                hudHasStartPos = true;
            }
            const dx = carModel.position.x - hudStartPos.x;
            const dz = carModel.position.z - hudStartPos.z;
            endlessDistanceValueEl.textContent = `${Math.floor(Math.sqrt(dx * dx + dz * dz) / 10)}m`;
        };
        
        let genX = 0;
        let genHeading = 0;
        const genPhase = seededRandom() * Math.PI * 2;
        
        for (let i = 0; i < totalItems + extraPoints; i++) {
            const z = - (i + 1) * spacing; 

            const targetHeading = Math.sin((i + 1) * 0.035 + genPhase) * 3;
            const steer = (targetHeading - genHeading) * 0.08 + (seededRandom() - 0.5) * 0.1 - genX * 0.0016;
            genHeading = THREE.MathUtils.clamp(genHeading + steer, -0.9, 0.9);
            genX += Math.sin(genHeading) * spacing * 0.9;
            genX *= 0.995;

            const x = genX + (seededRandom() - 0.5) * 3.0;
            const y = Math.sin(i * 1) * 5 + (seededRandom() - 0.5) * 5;
            
            currentPos = new THREE.Vector3(x, y, z);
            points.push(currentPos);
        }

        const curve = new THREE.CatmullRomCurve3(points);
        curve.tension = 0.5;
        curve.type = 'catmullrom';

        const distanceAhead = 15;

        const roadWidth = 12;
        const roadSegments = 200; 
        const roadGeometry = createRoadGeometry(curve, roadSegments, roadWidth);
        
        const roadTexture = createRoadTexture();
        roadTexture.wrapS = THREE.RepeatWrapping;
        roadTexture.wrapT = THREE.RepeatWrapping;
        roadTexture.repeat.set(1, 20); 
        roadTexture.anisotropy = 16;
        
        roadTexture.generateMipmaps = false;
        roadTexture.minFilter = THREE.LinearFilter;
        roadTexture.magFilter = THREE.LinearFilter;

        const roadMaterial = new THREE.MeshBasicMaterial({ 
            map: roadTexture,
            color: 0xffffff,
            side: THREE.DoubleSide
        });
        applyRoadShader(roadMaterial);
        
        const road = new THREE.Mesh(roadGeometry, roadMaterial);
        road.position.y = -2; 
        scene.add(road);

        const tmpCurvePoint = new THREE.Vector3();
        const tmpCurveTangent = new THREE.Vector3();
        
        const basePointCount = points.length;
        const baseRoadSegments = roadSegments;

        let manualGenIndex = basePointCount - 1;
        let manualRoadSegments = roadSegments;
        let manualRoadSampleCount = manualRoadSegments * 2;
        let manualRoadSampleX = new Float32Array(manualRoadSampleCount + 1);
        let manualRoadSampleY = new Float32Array(manualRoadSampleCount + 1);
        let manualRoadSampleZ = new Float32Array(manualRoadSampleCount + 1);

        const rebuildManualRoad = (forcedSegments = null) => {
            curve.points = points;
            curve.updateArcLengths();

            manualRoadSegments = forcedSegments ?? Math.min(2000, Math.max(200, Math.floor((points.length - 1) * 6)));
            const newGeo = createRoadGeometry(curve, manualRoadSegments, roadWidth);
            road.geometry.dispose();
            road.geometry = newGeo;

            manualRoadSampleCount = manualRoadSegments * 2;
            manualRoadSampleX = new Float32Array(manualRoadSampleCount + 1);
            manualRoadSampleY = new Float32Array(manualRoadSampleCount + 1);
            manualRoadSampleZ = new Float32Array(manualRoadSampleCount + 1);
            for (let i = 0; i <= manualRoadSampleCount; i++) {
                const t = i / manualRoadSampleCount;
                curve.getPointAt(t, tmpCurvePoint);
                manualRoadSampleX[i] = tmpCurvePoint.x;
                manualRoadSampleY[i] = tmpCurvePoint.y;
                manualRoadSampleZ[i] = tmpCurvePoint.z;
            }
        };

        const rand01 = (a, b) => {
            const v = Math.sin(a * 12.9898 + b * 78.233 + initialSeed) * 43758.5453;
            return v - Math.floor(v);
        };

        let genManualX = genX;
        let genManualHeading = genHeading;
        const genManualPhase = rand01(manualGenIndex, 9) * Math.PI * 2;

        const appendManualPoints = (count) => {
            for (let n = 0; n < count; n++) {
                const i = ++manualGenIndex;
                const z = - (i + 1) * spacing;

                const r3 = rand01(i, 3);
                const r4 = rand01(i, 4);

                const targetHeading = Math.sin((i + 1) * 0.035 + genManualPhase) * 0.65;
                const steer = (targetHeading - genManualHeading) * 0.08 + (r3 - 0.5) * 0.05 - genManualX * 0.0016;
                genManualHeading = THREE.MathUtils.clamp(genManualHeading + steer, -0.9, 0.9);
                genManualX += Math.sin(genManualHeading) * spacing * 0.9;
                genManualX *= 0.995;

                const x = genManualX + (rand01(i, 8) - 0.5) * 3.0;
                const y = Math.sin(i * 1) * 5 + (r4 - 0.5) * 2;

                points.push(new THREE.Vector3(x, y, z));
            }
        };

        rebuildManualRoad(baseRoadSegments);

        let carModel = null;
        const gltfLoader = new GLTFLoader();
        
        const finishCarAsset = startAsset();
        gltfLoader.load('/3d/car.glb', (gltf) => {
            try {
                carModel = gltf.scene;
                carModel.scale.set(6, 6, 6); 
                carModel.rotateY(Math.PI);
                
                carModel.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = false;
                        child.receiveShadow = false;
                        
                        if (child.material) {
                             const oldMat = child.material;
                             const newMat = new THREE.MeshBasicMaterial({
                                 color: oldMat.color,
                                 map: oldMat.map,
                                 side: oldMat.side,
                                 transparent: oldMat.transparent,
                                 opacity: oldMat.opacity
                             });
                             child.material = newMat;
                        }
                    }
                });
                scene.add(carModel);
            } catch (error) {
                console.error("Error applying car model:", error);
            } finally {
                finishCarAsset();
            }
        }, undefined, (error) => {
            console.error("Error loading car:", error);
            finishCarAsset();
        });

        const particleCount = 20;
        const particleGeo = new THREE.SphereGeometry(0.3, 7, 5); 
        const particleMat = new THREE.MeshBasicMaterial({ 
            color: 0xdddddd, 
            flatShading: true 
        });
        const activeParticles = [];
        const particlePool = createPool({
            create: () => {
                const mesh = new THREE.Mesh(particleGeo, particleMat.clone());
                scene.add(mesh);
                return {
                    mesh,
                    life: 0,
                    maxLife: 1.0,
                    velocity: new THREE.Vector3()
                };
            },
            onAcquire: (p) => {
                p.mesh.visible = true;
                p.life = 0;
            },
            onRelease: (p) => {
                p.mesh.visible = false;
                p.life = 0;
            },
            initialSize: particleCount
        });

        const objects = [];

        const envGroup = new THREE.Group();
        scene.add(envGroup);
        const proceduralEnvGroup = new THREE.Group();
        proceduralEnvGroup.visible = true;
        envGroup.add(proceduralEnvGroup);

        let treeModel = null;
        let cactusModel = null;
        const treePool = createPool({
            create: () => (treeModel ? treeModel.clone() : null),
            onAcquire: (obj) => {
                if (!obj.parent) proceduralEnvGroup.add(obj);
                obj.visible = false;
            },
            onRelease: (obj) => {
                obj.visible = false;
            }
        });
        const cactusPool = createPool({
            create: () => (cactusModel ? cactusModel.clone() : null),
            onAcquire: (obj) => {
                if (!obj.parent) proceduralEnvGroup.add(obj);
                obj.visible = false;
            },
            onRelease: (obj) => {
                obj.visible = false;
            }
        });
        const activeManualVeg = [];
        const activeVegKeys = new Set();
        let manualVegAheadCursor = 0;
        let manualVegBehindCursor = 0;
        let vegWarmup = 0;
        let vegNeedsResync = false;

        const ensureVegMaterialCache = (obj) => {
            if (obj.userData && obj.userData.vegMaterialCache) return obj.userData.vegMaterialCache;
            const mats = [];
            obj.traverse((child) => {
                if (!child.isMesh) return;
                child.userData = child.userData || {};
                if (!child.userData.vegMaterialCloned) {
                    const mat = child.material;
                    if (Array.isArray(mat)) {
                        child.material = mat.map((m) => (m ? m.clone() : m));
                    } else if (mat) {
                        child.material = mat.clone();
                    }
                    child.userData.vegMaterialCloned = true;
                }
                const mat = child.material;
                if (Array.isArray(mat)) {
                    for (const m of mat) if (m) mats.push(m);
                } else if (mat) {
                    mats.push(mat);
                }
            });
            for (const m of mats) {
                m.userData = m.userData || {};
                if (m.userData.vegBaseOpacity == null) m.userData.vegBaseOpacity = (m.opacity == null ? 1 : m.opacity);
                m.transparent = true;
            }
            obj.userData = obj.userData || {};
            obj.userData.vegMaterialCache = mats;
            return mats;
        };
        const setVegOpacity = (obj, opacity01) => {
            const mats = ensureVegMaterialCache(obj);
            const o = THREE.MathUtils.clamp(opacity01, 0, 1);
            for (const m of mats) {
                const base = m.userData?.vegBaseOpacity ?? 1;
                m.opacity = base * o;
            }
        };
        const primeVegObject = (obj) => {
            obj.visible = false;
            obj.userData = obj.userData || {};
            obj.userData.vegAppear = 0;
            obj.userData.vegAppearDir = 1;
            obj.userData.vegTargetScale = 1;
            setVegOpacity(obj, 0);
        };
        const activateVegObject = (obj, targetScale) => {
            obj.userData = obj.userData || {};
            obj.userData.vegAppear = 0;
            obj.userData.vegAppearDir = 1;
            obj.userData.vegTargetScale = targetScale;
            obj.visible = true;
            setVegOpacity(obj, 0);
            obj.scale.setScalar(Math.max(0.001, targetScale * 0.15));
        };

        const vegRaycaster = new THREE.Raycaster();
        const vegDown = new THREE.Vector3(0, -1, 0);
        const hash01 = (x) => {
            const v = Math.sin(x) * 43758.5453;
            return v - Math.floor(v);
        };
        const acquireVeg = (type) => {
            return (type === 'tree' ? treePool : cactusPool).acquire();
        };
        const releaseVeg = (type, obj) => {
            (type === 'tree' ? treePool : cactusPool).release(obj);
        };
        const resetManualVegetation = () => {
            for (const e of activeManualVeg) {
                activeVegKeys.delete(e.key);
                releaseVeg(e.type, e.obj);
            }
            activeManualVeg.length = 0;
            manualVegAheadCursor = 0;
            manualVegBehindCursor = 0;
        };
        const manualMaxPoints = 520;
        const manualKeepBehindPoints = 90;
        const manualVegBehindSamples = 220;
        const manualVegAheadSamples = 260;
        const manualVegPrefetchAheadSamples = 260;
        const manualVegStep = 4;
        const vegMaxPlacementsPerFrame = 7;
        const vegWarmupMaxSampleOffset = 40;
        const vegCellSize = 14;
        const vegCullRadius = 900;
        const vegCullRadiusSq = vegCullRadius * vegCullRadius;
        const vegSpawnInterval = 24;
        const vegFadeStart = 50;
        const vegFadeEnd = 90;
        const smoothstep01 = (edge0, edge1, x) => {
            const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
            return t * t * (3 - 2 * t);
        };
        const releaseOutOfRangeManualVeg = (carX, carZ) => {
            for (let i = activeManualVeg.length - 1; i >= 0; i--) {
                const e = activeManualVeg[i];
                const dx = e.obj.position.x - carX;
                const dz = e.obj.position.z - carZ;
                if ((dx * dx + dz * dz) > vegCullRadiusSq) {
                    e.obj.userData = e.obj.userData || {};
                    e.obj.userData.vegAppearDir = -1;
                }
            }
        };
        const updateManualVegAppearances = (timeScale) => {
            const speedIn = 0.08 * timeScale;
            const speedOut = 0.12 * timeScale;
            for (let i = activeManualVeg.length - 1; i >= 0; i--) {
                const e = activeManualVeg[i];
                e.obj.userData = e.obj.userData || {};
                const dir = e.obj.userData.vegAppearDir ?? 1;
                const targetScale = e.obj.userData.vegTargetScale ?? 1;
                let a = e.obj.userData.vegAppear ?? 0;
                a = THREE.MathUtils.clamp(a + (dir >= 0 ? speedIn : -speedOut), 0, 1);
                e.obj.userData.vegAppear = a;
                const eased = a * a * (3 - 2 * a);
                const dx = camera.position.x - e.obj.position.x;
                const dy = camera.position.y - e.obj.position.y;
                const dz = camera.position.z - e.obj.position.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                const distAlpha = 1 - smoothstep01(vegFadeStart, vegFadeEnd, dist);
                setVegOpacity(e.obj, eased * distAlpha);
                e.obj.scale.setScalar(Math.max(0.001, targetScale * (0.15 + eased * 0.85)));
                if (dir < 0 && a <= 0.0001) {
                    activeVegKeys.delete(e.key);
                    releaseVeg(e.type, e.obj);
                    activeManualVeg.splice(i, 1);
                }
            }
        };
        const fillManualVegetation = (fromSample, toSample, maxPlacements) => {
            if (!treeModel && !cactusModel) return fromSample;
            if (toSample === fromSample) return fromSample;
            const clampedFrom = Math.max(0, Math.min(manualRoadSampleCount, fromSample));
            const clampedTo = Math.max(0, Math.min(manualRoadSampleCount, toSample));
            const dir = clampedTo >= clampedFrom ? 1 : -1;
            let placed = 0;
            let i = clampedFrom;
            for (; dir > 0 ? (i <= clampedTo) : (i >= clampedTo); i += dir * vegSpawnInterval) {
                const jitter = Math.floor((hash01(i * 17.71 + initialSeed) - 0.5) * (vegSpawnInterval * 0.6));
                const siBase = Math.max(0, Math.min(manualRoadSampleCount, i + jitter));
                for (let attempt = 0; attempt < 3; attempt++) {
                    const si = Math.max(0, Math.min(manualRoadSampleCount, siBase + attempt * manualVegStep));

                    const t = si / manualRoadSampleCount;
                    curve.getPointAt(t, tmpVegCenter);
                    curve.getTangentAt(t, tmpVegTangent).normalize();
                    tmpVegSide.crossVectors(tmpVegTangent, yAxis).normalize();

                    const side = hash01(si * 78.233 + initialSeed) > 0.5 ? 1 : -1;
                    const distRnd = hash01(si * 41.17 + initialSeed);
                    const dist = (terrainStartOffset + 6) + distRnd * 38;

                    const px = tmpVegCenter.x + tmpVegSide.x * (side * dist);
                    const pz = tmpVegCenter.z + tmpVegSide.z * (side * dist) + (hash01(si * 19.19 + initialSeed) - 0.5) * 18;
                    const key = `${Math.round(px / vegCellSize)},${Math.round(pz / vegCellSize)}`;
                    if (activeVegKeys.has(key)) continue;

                    const biome = getBiome(px, pz);
                    const type = biome === 'grass' ? 'tree' : 'cactus';
                    const obj = acquireVeg(type);
                    if (!obj) continue;
                    primeVegObject(obj);

                    vegRaycaster.set(tmpRayOrigin.set(px, 50, pz), vegDown);
                    const hits = vegRaycaster.intersectObjects([leftTerrain, rightTerrain], false);
                    let py = -2;
                    if (hits.length > 0) py = hits[0].point.y;

                    let targetScale = 1;
                    if (type === 'tree') {
                        obj.position.set(px, py + 4.25, pz);
                        targetScale = 4 + hash01(si * 3.11 + initialSeed) * 5;
                    } else {
                        obj.position.set(px, py, pz);
                        targetScale = 4 + hash01(si * 3.11 + initialSeed) * 2;
                    }
                    obj.rotation.y = hash01(si * 2.71 + initialSeed) * Math.PI * 2;
                    activateVegObject(obj, targetScale);

                    activeVegKeys.add(key);
                    activeManualVeg.push({ type, obj, key });
                    placed++;
                    break;
                }
                if (placed >= maxPlacements) break;
            }
            return i;
        };

        const getBiome = (x, z) => {
            const scale = 0.025; 
            const noise = Math.sin((x + initialSeed) * scale) + Math.cos((z + initialSeed) * scale * 0.7);
            const detail = Math.sin((x + initialSeed) * 0.05) * 0.1 + Math.cos((z + initialSeed) * 0.05) * 0.1;
            
            const val = noise + detail;
            
            if (val > 0.2) return 'grass';
            return 'desert';
        };

        const getBiomeColor = (x, z) => {
            const biome = getBiome(x, z);
            if (biome === 'grass') return 0x9bc22c; 
            return 0xfacc15; 
        };
        
        const terrainSteps = 100; 
        
        const terrainWidth = 100; 
        const terrainStartOffset = roadWidth / 2; 
        const widthSegments = 10; 
        
        const createSideGeometry = (curve, segments, offsetStart, offsetEnd) => {
            const geometry = new THREE.BufferGeometry();
            const vertices = [];
            const colors = [];
            const indices = [];
            const up = new THREE.Vector3(0, 1, 0);

            const totalWidthSegments = widthSegments;
            
            for (let i = 0; i <= segments; i++) {
                const t = i / segments ;
                const point = curve.getPointAt(t);
                const tangent = curve.getTangentAt(t).normalize();
                const sideVec = new THREE.Vector3().crossVectors(tangent, up).normalize();
                
                for (let j = 0; j <= totalWidthSegments; j++) {
                    const widthRatio = j / totalWidthSegments; 
                    
                    const currentOffset = offsetStart + (offsetEnd - offsetStart) * widthRatio;
                    
                    const pos = new THREE.Vector3().copy(point).add(sideVec.clone().multiplyScalar(currentOffset));
                    
                    const biome = getBiome(pos.x, pos.z);
                    const colorHex = getBiomeColor(pos.x, pos.z);
                    const biomeColor = new THREE.Color(colorHex);

                    let height = 0;
                    
                    if (widthRatio > 0.1) {
                        const distFactor = (widthRatio - 0.1) / 0.9; 
                        
                        const noise1 = Math.sin(i * 0.1 + j * 0.5 + initialSeed) * 5;
                        const noise2 = Math.cos(i * 0.3 + j * 0.2 + initialSeed) * 10;
                        const noise3 = Math.sin(i * 0.05 + initialSeed) * 20; 
                        
                        let baseHeight = Math.abs(noise1 + noise2 + noise3);
                        
                        if (biome === 'desert') {
                            baseHeight *= 0.8; 
                            baseHeight = Math.abs(Math.sin(i * 0.2 + j * 1.0 + initialSeed) * 15); 
                        } else {
                            baseHeight *= 1.2; 
                        }
                        
                        height = baseHeight * distFactor; 
                    }
                    
                    pos.y += height;
                    
                    vertices.push(pos.x, pos.y, pos.z);
                    
                    const noiseVal = Math.sin(i * 12.9898 + j * 78.233 + initialSeed) * 43758.5453;
                    const brightnessNoise = ((noiseVal - Math.floor(noiseVal)) - 0.5) * 0.01;
                    biomeColor.addScalar(brightnessNoise);
                    
                    colors.push(biomeColor.r, biomeColor.g, biomeColor.b);
                }
            }

            const verticesPerRow = totalWidthSegments + 1;
            for (let i = 0; i < segments; i++) {
                for (let j = 0; j < totalWidthSegments; j++) {
                    const a = i * verticesPerRow + j;
                    const b = i * verticesPerRow + j + 1;
                    const c = (i + 1) * verticesPerRow + j;
                    const d = (i + 1) * verticesPerRow + j + 1;
                    
                    indices.push(a, b, d);
                    indices.push(a, d, c);
                }
            }

            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            geometry.setIndex(indices);
            geometry.computeVertexNormals();

            return geometry;
        };

        const leftTerrainGeo = createSideGeometry(curve, roadSegments, -terrainStartOffset, -(terrainStartOffset + terrainWidth));
        const rightTerrainGeo = createSideGeometry(curve, roadSegments, terrainStartOffset, terrainStartOffset + terrainWidth);
        
        const terrainMat = new THREE.MeshBasicMaterial({
            vertexColors: true,
            side: THREE.DoubleSide,
        });
        const signShadowMax = 64;
        const signShadowPositions = Array.from({ length: signShadowMax }, () => new THREE.Vector3(1e9, 0, 1e9));
        let signShadowCount = 0;
        terrainMat.userData = terrainMat.userData || {};
        terrainMat.userData.signShadowMax = signShadowMax;
        terrainMat.userData.signShadowPositions = signShadowPositions;
        terrainMat.userData.uniforms = terrainMat.userData.uniforms || {};
        terrainMat.userData.uniforms.signCount = { value: 0 };
        terrainMat.userData.uniforms.signPos = { value: signShadowPositions };
        applyFadeToMaterial(terrainMat);

        const leftTerrain = new THREE.Mesh(leftTerrainGeo, terrainMat);
        const rightTerrain = new THREE.Mesh(rightTerrainGeo, terrainMat);
        
        leftTerrain.position.y = -2.1; 
        rightTerrain.position.y = -2.1;
        
        scene.add(leftTerrain);
        scene.add(rightTerrain);
        
        const rebuildManualTerrain = (forcedSegments = null) => {
            const segs = forcedSegments ?? manualRoadSegments;
            const newLeft = createSideGeometry(curve, segs, -terrainStartOffset, -(terrainStartOffset + terrainWidth));
            const newRight = createSideGeometry(curve, segs, terrainStartOffset, terrainStartOffset + terrainWidth);
            leftTerrain.geometry.dispose();
            rightTerrain.geometry.dispose();
            leftTerrain.geometry = newLeft;
            rightTerrain.geometry = newRight;
        };

        const loadModel = (url) => {
            return new Promise((resolve) => {
                const finishModelAsset = startAsset();
                gltfLoader.load(url, (gltf) => {
                    try {
                        const model = gltf.scene;
                        model.traverse((child) => {
                            if (child.isMesh) {
                                if (child.material) {
                                    const oldMat = child.material;
                                    const newMat = new THREE.MeshBasicMaterial({
                                        color: oldMat.color,
                                        map: oldMat.map,
                                        side: oldMat.side,
                                        transparent: true
                                    });
                                    applyFadeToMaterial(newMat);
                                    child.material = newMat;
                                }
                            }
                        });
                        resolve(model);
                    } catch (error) {
                        console.error(`Error applying ${url}`, error);
                        resolve(null);
                    } finally {
                        finishModelAsset();
                    }
                }, undefined, (err) => {
                    console.error(`Error loading ${url}`, err);
                    resolve(null); 
                    finishModelAsset();
                });
            });
        };

        Promise.all([
            loadModel('/3d/tree.glb'),
            loadModel('/3d/cactus.glb')
        ]).then(([tree, cactus]) => {
            treeModel = tree;
            cactusModel = cactus;
            leftTerrain.updateMatrixWorld();
            rightTerrain.updateMatrixWorld();
            resetManualVegetation();
            
            const raycaster = new THREE.Raycaster();
            const down = new THREE.Vector3(0, -1, 0);

            for (let i = 0; i < terrainSteps; i++) {
                const curveT = i / terrainSteps;
                const center = curve.getPointAt(curveT);
                
                const sideCount = 1; 
                
                for (let s = 0; s < sideCount; s++) {
                    const minDist = terrainStartOffset + 5;
                    const maxDist = terrainStartOffset + 40; 
                    
                    const dist = minDist + seededRandom() * (maxDist - minDist);
                    const side = seededRandom() > 0.5 ? 1 : -1;
                    
                    const px = center.x + side * dist;
                    const pz = center.z + (seededRandom() - 0.5) * 20;
                    
                    raycaster.set(new THREE.Vector3(px, 50, pz), down);
                    const intersects = raycaster.intersectObjects([leftTerrain, rightTerrain]);
                    
                    let py = -2; 
                    if (intersects.length > 0) {
                        py = intersects[0].point.y;
                    }
                    
                    const biome = getBiome(px, pz);
                    
                    if (biome === 'grass' && treeModel) {
                        if (seededRandom() > 0.6) {
                            const tree = treeModel.clone();
                            tree.position.set(px, py + 4.25, pz);
                            tree.rotation.y = seededRandom() * Math.PI * 2;
                            const scale = 4 + seededRandom() * 5; 
                            tree.scale.setScalar(scale);
                            envGroup.add(tree);
                        }
                    } else if (biome === 'desert' && cactusModel) {
                        if (seededRandom() > 0.5) {
                            const cactus = cactusModel.clone();
                            cactus.position.set(px, py, pz);
                            cactus.rotation.y = seededRandom() * Math.PI * 2;
                            const scale = 4 + seededRandom() * 2; 
                            cactus.scale.setScalar(scale);
                            envGroup.add(cactus);
                        }
                    }
                }
            }
        });

        function prepareFadeMaterials(obj) {
            if (obj.userData && obj.userData.fadePrepared) return;
            if (!obj.userData) obj.userData = {};
            obj.userData.fadePrepared = true;

            obj.traverse((child) => {
                if (!(child.isMesh || child.isSprite)) return;
                const mat = child.material;
                if (!mat) return;

                if (Array.isArray(mat)) {
                    const next = mat.map((m) => {
                        if (!m) return m;
                        const c = m.clone();
                        if (!c.userData) c.userData = {};
                        if (c.userData.baseOpacity == null) c.userData.baseOpacity = c.opacity ?? 1;
                        c.transparent = true;
                        c.depthWrite = false;
                        return c;
                    });
                    child.material = next;
                } else {
                    const c = mat.clone();
                    if (!c.userData) c.userData = {};
                    if (c.userData.baseOpacity == null) c.userData.baseOpacity = c.opacity ?? 1;
                    c.transparent = true;
                    c.depthWrite = false;
                    child.material = c;
                }
            });
        }

        function setOpacity(obj, opacity) {
            obj.traverse((child) => {
                if (child.isMesh || child.isSprite) {
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            for (const m of child.material) {
                                if (!m) continue;
                                if (!m.userData) m.userData = {};
                                if (m.userData.baseOpacity == null) m.userData.baseOpacity = (m.opacity ?? 1);
                                if (m.userData.baseTransparent == null) m.userData.baseTransparent = !!m.transparent;
                                if (m.userData.baseDepthWrite == null) m.userData.baseDepthWrite = (m.depthWrite ?? true);
                                const base = m.userData.baseOpacity;
                                const nextOpacity = base * opacity;
                                m.opacity = nextOpacity;
                                if (opacity < 0.999) {
                                    m.transparent = true;
                                    m.depthWrite = false;
                                } else {
                                    m.transparent = m.userData.baseTransparent;
                                    m.depthWrite = m.userData.baseDepthWrite;
                                }
                            }
                        } else {
                            const m = child.material;
                            if (!m.userData) m.userData = {};
                            if (m.userData.baseOpacity == null) m.userData.baseOpacity = (m.opacity ?? 1);
                            if (m.userData.baseTransparent == null) m.userData.baseTransparent = !!m.transparent;
                            if (m.userData.baseDepthWrite == null) m.userData.baseDepthWrite = (m.depthWrite ?? true);
                            const base = m.userData.baseOpacity;
                            const nextOpacity = base * opacity;
                            m.opacity = nextOpacity;
                            if (opacity < 0.999) {
                                m.transparent = true;
                                m.depthWrite = false;
                            } else {
                                m.transparent = m.userData.baseTransparent;
                                m.depthWrite = m.userData.baseDepthWrite;
                            }
                        }
                    }
                }
            });
        }
        const stripHtml = (html) => {
            const raw = String(html ?? '');
            try {
                const doc = new DOMParser().parseFromString(raw, 'text/html');
                return doc.body.textContent || "";
            } catch {
                return raw.replace(/<[^>]*>/g, '');
            }
        };

        timelineData.forEach((item, index) => {
            const pointIndex = index + 1;
            const totalCurvePoints = points.length; 
            const t = pointIndex / (totalCurvePoints - 1); 

            const position = curve.getPointAt(t);
            const tangent = curve.getTangentAt(t).normalize();
            
            const up = new THREE.Vector3(0, 1, 0);
            let sideVector = new THREE.Vector3().crossVectors(tangent, up).normalize();
            
            const nextT = Math.min(1, t + 0.05);
            
            const tangent2 = curve.getTangentAt(nextT).normalize();
            const turn = tangent.x * tangent2.z - tangent.z * tangent2.x; 
            
            let sideOffsetDir = turn > 0 ? 1 : -1;
            
            if (Math.abs(turn) < 0.01) {
                sideOffsetDir = (index % 2 === 0) ? 1 : -1;
            }

            const sideOffset = sideOffsetDir * (roadWidth * 0.5 + 0.8);
            const itemPos = position.clone().add(sideVector.multiplyScalar(sideOffset));
            const signScale = 1.5;
            const postHeight = 3;

            tmpRayOrigin.set(itemPos.x, 50, itemPos.z);
            raycaster.set(tmpRayOrigin, downVector);
            let groundY = -2;
            const groundHits = raycaster.intersectObjects([leftTerrain, rightTerrain, road], false);
            if (groundHits.length > 0) {
                groundY = groundHits[0].point.y;
            }
            itemPos.y = groundY;

            if (signShadowCount < signShadowPositions.length) {
                signShadowPositions[signShadowCount].set(itemPos.x, groundY, itemPos.z);
                signShadowCount += 1;
            }

            const group = new THREE.Group();
            group.position.copy(itemPos);
            scene.add(group);
            objects.push(group);
            prepareFadeMaterials(group);
            setOpacity(group, 1);

            const hash01 = (x) => {
                const v = Math.sin(x) * 43758.5453;
                return v - Math.floor(v);
            };
            const randSigned = (k) => (hash01((index + 1) * 97.31 + k + initialSeed) - 0.5) * 2;

            const signRoot = new THREE.Group();
            signRoot.position.set(0, 0, 0);
            tmpRoadCenter.copy(position);
            tmpRoadCenter.y = itemPos.y;
            signRoot.lookAt(tmpRoadCenter);
            signRoot.rotateY(Math.PI);
            signRoot.scale.setScalar(signScale);
            group.add(signRoot);

            const postGeo = new THREE.CylinderGeometry(0.08, 0.1, postHeight, 8);
            const postMat = new THREE.MeshBasicMaterial({ color: 0x9ca3af });
            const post = new THREE.Mesh(postGeo, postMat);
            post.position.y = -postHeight / 2;
            post.position.z = -0.1;
            signRoot.add(post);

            const boardWidth = 1.6;
            const boardDepth = 0.1;
            const titleText = stripHtml(item.text).replace(/\s+/g, ' ').trim();
            const signTex = createMileMarkerTexture(String(item.date ?? ''), titleText, { width: 360 });
            const signAspect = (signTex?.image?.width && signTex?.image?.height) ? (signTex.image.height / signTex.image.width) : 2.2;
            const boardHeight = boardWidth * signAspect;

            const cornerRadius01 = signTex?.userData?.cornerRadius01;
            const cornerRadius = (typeof cornerRadius01 === 'number' && Number.isFinite(cornerRadius01))
                ? (boardWidth * cornerRadius01)
                : Math.min(boardWidth * 0.18, boardHeight * 0.09);
            const signShape = createRoundedRectShape(boardWidth, boardHeight, cornerRadius);

            const bodyGeo = new THREE.ExtrudeGeometry(signShape, { depth: boardDepth, bevelEnabled: false, steps: 1 });
            bodyGeo.translate(0, 0, -boardDepth / 2);
            const bodyMat = new THREE.MeshBasicMaterial({ color: 0x0b5d1e, side: THREE.DoubleSide });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.renderOrder = 1;

            const faceGeo = new THREE.ShapeGeometry(signShape);
            normalizeShapeUvs(faceGeo);
            const faceMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide });
            const face = new THREE.Mesh(faceGeo, faceMat);
            face.position.z = (boardDepth / 2) + 0.001;
            face.renderOrder = 2;

            const board = new THREE.Group();
            board.add(body);
            board.add(face);
            board.position.set(0, (boardHeight * 0.5) + 0.06, 0.18);
            board.rotation.z = randSigned(5.55) * 0.03;
            board.rotation.x = randSigned(6.66) * 0.02;
            signRoot.add(board);

            const desc = stripHtml(`${item.left ?? ''} ${item.right ?? ''}`)
                .replace(/\s+/g, ' ')
                .trim();
            markerInfo.push({ t, date: String(item.date ?? ''), title: titleText, desc });
        });
        if (terrainMat.userData.uniforms && terrainMat.userData.uniforms.signCount) {
            terrainMat.userData.uniforms.signCount.value = signShadowCount;
        }

        let targetT = 0;
        let lastScrollTop = -1;
        let scrollAtEnd = false;
        let scrollActivityFrames = 0;
        
        function updateScroll() {
            const scrollTop = scrollContainer.scrollTop;
            const scrollDelta = lastScrollTop >= 0 ? Math.abs(scrollTop - lastScrollTop) : 0;
            if (scrollDelta > 3) scrollActivityFrames = 30;
            if (scrollDelta > 3) markUserInteraction();
            
            if (Math.abs(scrollTop - lastScrollTop) > 1) {
                lastScrollTop = scrollTop;
            }

            const scrollHeight = scrollContainer.scrollHeight - scrollContainer.clientHeight;
            const scrollFraction = scrollHeight > 0 ? Math.max(0, Math.min(1, scrollTop / scrollHeight)) : 0;
            scrollAtEnd = scrollHeight > 0 && scrollTop >= (scrollHeight - 2);

            targetT = scrollFraction * maxT; 
        }
        
        scrollContainer.addEventListener('scroll', updateScroll);
        updateScroll();

        const clock = new THREE.Clock();
        const cameraLookAtCurrent = new THREE.Vector3();
        const cameraFromPos = new THREE.Vector3();
        const cameraFromLookAt = new THREE.Vector3();
        const cameraTargetPos = new THREE.Vector3();
        const cameraTargetLookAt = new THREE.Vector3();
        const carTargetQuat = new THREE.Quaternion();
        const carTargetMatrix = new THREE.Matrix4();
        const carLookAtTarget = new THREE.Vector3();
        const yAxis = new THREE.Vector3(0, 1, 0);
        const tmpSlopeDir = new THREE.Vector3();
        const basePos = new THREE.Vector3();
        const lookAheadPos = new THREE.Vector3();
        const tmpScrollSide = new THREE.Vector3();
        const tmpLookTangent = new THREE.Vector3();
        const tmpLookSide = new THREE.Vector3();
        const tmpRoadNormal = new THREE.Vector3();
        const tmpFinalPos = new THREE.Vector3();
        const tmpCamDir = new THREE.Vector3();
        const tmpCamOffset = new THREE.Vector3();
        const tmpCamLookOffset = new THREE.Vector3();
        const tmpSpawnPos = new THREE.Vector3();
        const tmpGroundNormal = new THREE.Vector3(0, 1, 0);
        let cameraBlend = 1;
        let wasManualControl = false;
        let currentT = 0;
        function animate() {
            if (destroyed) return;
            rafId = requestAnimationFrame(animate);
            
            const dt = clock.getDelta();
            const timeScale = dt * 60;
            if (scrollActivityFrames > 0) scrollActivityFrames--;

            const deltaT = (targetT - currentT) * 0.05;
            currentT += deltaT;
            
            const totalLen = curve.getLength();
            
            let realSpeed = 0;
            const tAhead = distanceAhead / totalLen;
            
            const carT = Math.min(1, currentT + tAhead); 
            
            if (carModel) {
                 let vegCarSampleIndex = Math.floor(carT * manualRoadSampleCount);
                 const hasDrivingInput = (keys.w || keys.a || keys.s || keys.d || keys.arrowup || keys.arrowdown || keys.arrowleft || keys.arrowright);
                 if (!hasDrivingInput) manualEntryArmed = true;
                 if (!isManualControl && hasDrivingInput && manualEntryArmed) {
                     isManualControl = true;
                     manualEntryArmed = false;
                 }
                 if (isManualControl && !isEndlessRunner && scrollActivityFrames > 0 && !hasDrivingInput) {
                     isManualControl = false;
                 }

                const justEnteredManual = isManualControl && !wasManualControl;
                if (justEnteredManual) {
                    manualPosition.copy(carModel.position);
                    manualVelocity.set(0, 0, 0);
                    carSpeed = 0;
                    manualSteerAngle = 0;
                    vegWarmup = 45;
                    manualNeedsGroundSnap = true;
                    manualStartLimitHasPos = true;
                    manualStartLimitActive = false;
                    manualStartLimitPos.copy(manualPosition);
                    manualStartLimitPos.y = 0;
                    carModel.getWorldDirection(tmpForwardDir);
                    tmpForwardDir.y = 0;
                    if (tmpForwardDir.lengthSq() > 1e-8) {
                       tmpForwardDir.normalize();
                       manualRotation = Math.atan2(-tmpForwardDir.x, -tmpForwardDir.z);
                     }
                }
                 
                 if (!isManualControl) {
                     curve.getPointAt(carT, tmpCurvePoint);
                     curve.getTangentAt(carT, tmpCurveTangent).normalize();
                     tmpScrollSide.crossVectors(tmpCurveTangent, yAxis).normalize();
                     const zigZagFreq = 60;
                     const zigZagAmp = 3;
                     const offset = Math.sin(carT * zigZagFreq) * zigZagAmp;

                     basePos.copy(tmpCurvePoint).addScaledVector(tmpScrollSide, offset);
                     tmpRayOrigin.set(basePos.x, 50, basePos.z);
                     raycaster.set(tmpRayOrigin, downVector);
                     const scrollHits = raycaster.intersectObject(road);
                     if (scrollHits.length > 0) basePos.y = scrollHits[0].point.y + chassisSkinWidth;
                     else basePos.y -= 1.3;
                     
                     carSpeed = 0;
                     manualVelocity.set(0, 0, 0);
                     manualRoadT = carT;
                     
                     realSpeed = Math.abs(deltaT) * totalLen;
                     
                     const lookAheadT = Math.min(1, carT + 0.005);
                     const laOffset = Math.sin(lookAheadT * zigZagFreq) * zigZagAmp;
                     curve.getPointAt(lookAheadT, lookAheadPos);
                     curve.getTangentAt(lookAheadT, tmpLookTangent).normalize();
                     tmpLookSide.crossVectors(tmpLookTangent, yAxis).normalize();
                     lookAheadPos.addScaledVector(tmpLookSide, laOffset);
                     tmpRayOrigin.set(lookAheadPos.x, 50, lookAheadPos.z);
                     raycaster.set(tmpRayOrigin, downVector);
                     const laHits = raycaster.intersectObject(road);
                     if (laHits.length > 0) lookAheadPos.y = laHits[0].point.y + chassisSkinWidth;
                     else lookAheadPos.y -= 1.5;
                     
                     manualPosition.copy(basePos);
                     vegCarSampleIndex = Math.floor(carT * manualRoadSampleCount);

                     if (lookAheadPos.distanceToSquared(basePos) > 1e-4) {
                        carModel.position.copy(basePos);
                        carModel.lookAt(lookAheadPos);
                     }
                     
                     carModel.getWorldDirection(tmpForwardDir);
                     tmpForwardDir.y = 0;
                     if (tmpForwardDir.lengthSq() > 1e-8) {
                        tmpForwardDir.normalize();
                        manualRotation = Math.atan2(tmpForwardDir.x, -tmpForwardDir.z);
                     }

                 } else {
                     tmpGroundNormal.set(0, 1, 0);
                     let targetChassisY = manualPosition.y;
                     let hasGround = false;

                     let bestDist2 = Infinity;
                     let bestIndex = 0;
                     let bestU = 0;
                     const px = manualPosition.x;
                     const pz = manualPosition.z;

                     for (let i = 0; i < manualRoadSampleCount; i++) {
                         const ax = manualRoadSampleX[i], az = manualRoadSampleZ[i];
                         const bx = manualRoadSampleX[i + 1], bz = manualRoadSampleZ[i + 1];
                         const dx = bx - ax, dz = bz - az;
                         const denom = dx * dx + dz * dz;
                         if (denom < 1e-8) continue;

                         let u = ((px - ax) * dx + (pz - az) * dz) / denom;
                         if (u < 0) u = 0;
                         else if (u > 1) u = 1;

                         const cx = ax + dx * u;
                         const cz = az + dz * u;
                         const ddx = px - cx;
                         const ddz = pz - cz;
                         const dist2 = ddx * ddx + ddz * ddz;
                         if (dist2 < bestDist2) {
                             bestDist2 = dist2;
                             bestIndex = i;
                             bestU = u;
                         }
                     }

                     const ax = manualRoadSampleX[bestIndex], az = manualRoadSampleZ[bestIndex], ay = manualRoadSampleY[bestIndex];
                     const bx = manualRoadSampleX[bestIndex + 1], bz = manualRoadSampleZ[bestIndex + 1], by = manualRoadSampleY[bestIndex + 1];
                     const segDx = bx - ax, segDz = bz - az;

                     manualRoadT = (bestIndex + bestU) / manualRoadSampleCount;
                     vegCarSampleIndex = bestIndex;

                     tmpRoadCenter.set(
                         ax + segDx * bestU,
                         ay + (by - ay) * bestU,
                         az + segDz * bestU
                     );

                    tmpRoadForward.set(segDx, 0, segDz);
                    if (tmpRoadForward.lengthSq() < 1e-8) tmpRoadForward.set(0, 0, -1);
                    else tmpRoadForward.normalize();
                    if (justEnteredManual && manualStartLimitHasPos) {
                        manualStartLimitForward.copy(tmpRoadForward);
                        manualStartLimitActive = true;
                    }
                    tmpRoadTangent.copy(tmpRoadForward);
                    tmpForwardDir.set(0, 0, -1).applyAxisAngle(yAxis, manualRotation);
                    tmpForwardDir.y = 0;
                    if (tmpForwardDir.lengthSq() > 1e-8) tmpForwardDir.normalize();
                    else tmpForwardDir.set(0, 0, -1);
                    if (tmpRoadTangent.dot(tmpForwardDir) < 0) tmpRoadTangent.negate();
                    tmpRoadSide.crossVectors(tmpRoadTangent, yAxis).normalize();
                    if (justEnteredManual) {
                        streetForwardSmoothed.copy(tmpRoadTangent);
                    } else {
                        tmpStreetForward.copy(tmpRoadTangent);
                        if (tmpStreetForward.dot(streetForwardSmoothed) < 0) tmpStreetForward.negate();
                        streetForwardSmoothed.lerp(tmpStreetForward, Math.min(1, 0.25 * timeScale)).normalize();
                    }

                    tmpRoadDelta.copy(manualPosition).sub(tmpRoadCenter);
                    const maxLateral = (roadWidth * 0.5) - 1.5;
                    const rawLateral = tmpRoadDelta.dot(tmpRoadSide);
                    const clampedLateral = THREE.MathUtils.clamp(rawLateral, -maxLateral, maxLateral);
                     if (!justEnteredManual || Math.abs(rawLateral) > maxLateral) {
                         manualPosition.x = tmpRoadCenter.x + tmpRoadSide.x * clampedLateral;
                         manualPosition.z = tmpRoadCenter.z + tmpRoadSide.z * clampedLateral;
                     }
                     if (manualStartLimitActive) {
                        tmpStartDelta.copy(manualPosition).sub(manualStartLimitPos);
                        tmpStartDelta.y = 0;
                        const behindStart = tmpStartDelta.dot(manualStartLimitForward);
                        if (behindStart < 0) {
                            manualPosition.addScaledVector(manualStartLimitForward, -behindStart);
                            const vForward = manualVelocity.dot(manualStartLimitForward);
                            if (vForward < 0) manualVelocity.addScaledVector(manualStartLimitForward, -vForward);
                        }
                     }
                     if (rawLateral > maxLateral) {
                         const sideVel = manualVelocity.dot(tmpRoadSide);
                         if (sideVel > 0) manualVelocity.addScaledVector(tmpRoadSide, -sideVel);
                     } else if (rawLateral < -maxLateral) {
                         const sideVel = manualVelocity.dot(tmpRoadSide);
                         if (sideVel < 0) manualVelocity.addScaledVector(tmpRoadSide, -sideVel);
                     }

                    {
                       const vForward = manualVelocity.dot(tmpRoadTangent);
                        if (manualRoadT > 0.82 && vForward > 0.02) {
                            appendManualPoints(30);
                            const extraPointCount = points.length - basePointCount;
                            if (extraPointCount > manualMaxPoints && manualRoadT > 0.45) {
                                const carPointApprox = Math.floor(manualRoadT * (points.length - 1));
                                const carExtraApprox = Math.max(0, carPointApprox - basePointCount);
                                const removableExtra = extraPointCount - (manualKeepBehindPoints + 6);
                                const removeCount = Math.max(0, Math.min(carExtraApprox - manualKeepBehindPoints, removableExtra));
                                if (removeCount > 0) {
                                    points.splice(basePointCount, removeCount);
                                }
                            }
                            rebuildManualRoad();
                            rebuildManualTerrain();
                            vegWarmup = 45;
                            vegNeedsResync = true;
                        }
                      }

                     tmpRayOrigin.set(manualPosition.x, 50, manualPosition.z);
                     raycaster.set(tmpRayOrigin, downVector);
                     const hits = raycaster.intersectObject(road);
                     if (hits.length > 0) {
                         hasGround = true;
                         targetChassisY = hits[0].point.y + chassisSkinWidth;
                         if (hits[0].face) {
                             tmpWorldNormal.copy(hits[0].face.normal).transformDirection(hits[0].object.matrixWorld);
                             tmpGroundNormal.copy(tmpWorldNormal);
                         }
                     }

                     if (tmpGroundNormal.y < 0) tmpGroundNormal.negate();
                     groundNormalSmoothed.lerp(tmpGroundNormal, Math.min(1, 0.08 * timeScale)).normalize();

                     if (manualNeedsGroundSnap && hasGround) {
                        manualPosition.y = targetChassisY;
                        manualVelocity.y = 0;
                        manualNeedsGroundSnap = false;
                     }

                     if (hasGround) {
                        const upDelta = targetChassisY - manualPosition.y;
                        if (upDelta > 0) {
                            const maxUpStep = 0.35 * timeScale;
                            manualPosition.y += Math.min(upDelta, maxUpStep);
                            if (manualVelocity.y < 0) manualVelocity.y = 0;
                        }
                     }

                    const accel = acceleration * timeScale;
                    const forwardInput = keys.w || keys.arrowup;
                    const backwardInput = keys.s || keys.arrowdown;

                    if (isEndlessRunner) {
                        carSpeed = Math.min(carSpeed + accel, maxSpeed);
                    } else if (forwardInput && !backwardInput) {
                        carSpeed = Math.min(carSpeed + accel, maxSpeed);
                    } else if (backwardInput && !forwardInput) {
                        carSpeed = Math.max(carSpeed - accel, -maxSpeed);
                    } else {
                        const frictionFactor = Math.pow(friction, timeScale);
                        carSpeed *= frictionFactor;
                        if (Math.abs(carSpeed) < 1e-4) carSpeed = 0;
                    }
                    
                    {
                        const maxSteer = Math.PI / 6;
                        const horizontalSpeed = Math.hypot(manualVelocity.x, manualVelocity.z);
                        const speedFactor = Math.min(1, horizontalSpeed / 1.2);
                        const steerInput = ((keys.a || keys.arrowleft) ? 1 : 0) + ((keys.d || keys.arrowright) ? -1 : 0);

                        const steerRate = 0.12 * (0.35 + 0.65 * speedFactor) * timeScale;
                        manualSteerAngle += steerInput * steerRate;
                        if (steerInput === 0) manualSteerAngle *= Math.pow(0.85, timeScale);
                        manualSteerAngle = THREE.MathUtils.clamp(manualSteerAngle, -maxSteer, maxSteer);

                        const yawFromSteer = 0.08 * speedFactor * timeScale;
                        const reverseSteer = carSpeed < 0 ? -1 : 1;
                        manualRotation += manualSteerAngle * yawFromSteer * reverseSteer;
                    }

                    tmpForwardDir.set(0, 0, -1).applyAxisAngle(yAxis, manualRotation).normalize();
                    const forwardVec = tmpForwardDir;
                    const drivingOnGround = hasGround && manualPosition.y <= targetChassisY + 0.05;
                    
                    if (drivingOnGround) {
                        forwardVec.projectOnPlane(groundNormalSmoothed).normalize();
                    }

                    manualVelocity.addScaledVector(forwardVec, carSpeed * 0.12 * timeScale);

                    if (drivingOnGround) {
                        const horizontalSpeed = Math.hypot(manualVelocity.x, manualVelocity.z);
                        if (horizontalSpeed > 1e-4) {
                            const speedFactor = Math.min(1, horizontalSpeed / 1.2);
                            tmpVelDir.set(manualVelocity.x, 0, manualVelocity.z).multiplyScalar(1 / horizontalSpeed);
                            tmpDesiredDir.copy(forwardVec);
                            if (carSpeed < 0) tmpDesiredDir.negate();
                            tmpDesiredDir.y = 0;
                            if (tmpDesiredDir.lengthSq() > 1e-8) {
                                tmpDesiredDir.normalize();
                                const steerStrength = (0.12 + 0.45 * speedFactor) * timeScale;
                                tmpVelDir.lerp(tmpDesiredDir, Math.min(1, steerStrength)).normalize();
                                manualVelocity.x = tmpVelDir.x * horizontalSpeed;
                                manualVelocity.z = tmpVelDir.z * horizontalSpeed;
                            }
                        }
                    }
                    
                    const velFriction = Math.pow(0.87, timeScale);
                    manualVelocity.x *= velFriction;
                    manualVelocity.z *= velFriction;
                    manualVelocity.y *= Math.pow(0.99, timeScale);
                    manualVelocity.y -= gravity * timeScale;
                    
                    manualPosition.addScaledVector(manualVelocity, timeScale);

                    if (hasGround && manualPosition.y < targetChassisY) {
                        manualPosition.y = targetChassisY;
                        if (manualVelocity.y < 0) manualVelocity.y = 0;
                        if (manualVelocity.dot(groundNormalSmoothed) < 0) {
                            manualVelocity.projectOnPlane(groundNormalSmoothed);
                        }
                    }

                    onGround = hasGround && manualPosition.y <= targetChassisY + 0.05;

                    if (onGround) {
                        if (manualVelocity.y < 0) manualVelocity.y = 0;
                        const slopeAngle = groundNormalSmoothed.angleTo(yAxis);
                        if (slopeAngle > 0.05) {
                            tmpSlopeDir.copy(downVector).projectOnPlane(groundNormalSmoothed).normalize();
                            manualVelocity.addScaledVector(tmpSlopeDir, slopeAngle * 0.01 * timeScale);
                        }
                    }
                     
                     carModel.position.copy(manualPosition);
                     
                     const targetUp = onGround ? groundNormalSmoothed : yAxis;
                     carLookAtTarget.copy(manualPosition).addScaledVector(forwardVec, -1);
                     carTargetMatrix.lookAt(manualPosition, carLookAtTarget, targetUp);
                     carTargetQuat.setFromRotationMatrix(carTargetMatrix);
                     carModel.quaternion.slerp(carTargetQuat, Math.min(1, 0.15 * timeScale));

                     basePos.copy(manualPosition);
                     realSpeed = manualVelocity.length(); 
                 }

                 const rawProgress = maxT > 1e-8 ? (manualRoadT / maxT) : 0;
                 const reachedEnd = rawProgress >= 1 - 1e-4;
                if (!isEndlessRunner && isManualControl && reachedEnd) {
                    setEndlessRunnerMode(true);
                    endlessLives = 3;
                    renderEndlessLives();
                    showHintTemporarily('Endless Mode', 1800);
                }

                 if (!isEndlessRunner) {
                    const progress = THREE.MathUtils.clamp(rawProgress, 0, 1);
                    progressFill.style.transform = `scaleX(${progress})`;
                    {
                        const viewportWidth = progressViewport.clientWidth;
                        const innerWidth = progressInner.scrollWidth;
                        if (innerWidth > viewportWidth + 1) {
                            const maxScroll = innerWidth - viewportWidth;
                            const scrollX = THREE.MathUtils.clamp(progress * maxScroll, 0, maxScroll);
                            progressInner.style.transform = `translateX(-${scrollX}px)`;
                        } else {
                            progressInner.style.transform = 'translateX(0)';
                        }
                    }
                    for (const m of markerEls) {
                         const d = Math.abs(progress - m.pos);
                        const influence = Math.max(0, 1 - d * 10);
                        const scale = 1 + influence * 1.4;
                        m.marker.style.setProperty('--scale', String(scale));
                        m.label.style.opacity = String(0.65 + influence * 0.35);
                    }
                }
                 
                {
                    const minSample = Math.max(0, vegCarSampleIndex - manualVegBehindSamples);
                    const maxSample = Math.min(manualRoadSampleCount, vegCarSampleIndex + manualVegAheadSamples);
                    const maxFillSample = Math.min(manualRoadSampleCount, maxSample + manualVegPrefetchAheadSamples);
                    tmpVegCarPos.copy(carModel.position);
                    releaseOutOfRangeManualVeg(tmpVegCarPos.x, tmpVegCarPos.z);
                    updateManualVegAppearances(timeScale);
                    if (!activeManualVeg.length && manualVegAheadCursor === 0 && manualVegBehindCursor === 0) {
                        manualVegAheadCursor = vegCarSampleIndex;
                        manualVegBehindCursor = vegCarSampleIndex;
                    }
                    if (vegNeedsResync) {
                        manualVegAheadCursor = vegCarSampleIndex;
                        manualVegBehindCursor = vegCarSampleIndex;
                        vegNeedsResync = false;
                    }
                    manualVegAheadCursor = Math.max(vegCarSampleIndex, Math.min(maxFillSample, manualVegAheadCursor));
                    manualVegBehindCursor = Math.max(minSample, Math.min(vegCarSampleIndex, manualVegBehindCursor));
                    if ((treeModel || cactusModel)) {
                        const aheadBacklog = Math.max(0, (maxFillSample - manualVegAheadCursor) / vegSpawnInterval);
                        const aheadCatchup = Math.min(55, Math.floor(aheadBacklog * 0.4));
                        const aheadWarmupBoost = vegWarmup > 0 ? 28 : 0;
                        const aheadBudget = vegMaxPlacementsPerFrame + aheadCatchup + aheadWarmupBoost;
                        const aheadToSample = vegWarmup > 0
                            ? Math.min(maxFillSample, vegCarSampleIndex + manualVegAheadSamples + vegWarmupMaxSampleOffset)
                            : maxFillSample;
                        if (manualVegAheadCursor <= aheadToSample) {
                            manualVegAheadCursor = fillManualVegetation(manualVegAheadCursor, aheadToSample, aheadBudget);
                        }

                        const behindBacklog = Math.max(0, (manualVegBehindCursor - minSample) / vegSpawnInterval);
                        const behindCatchup = Math.min(18, Math.floor(behindBacklog * 0.25));
                        const behindBudget = (vegWarmup > 0 ? 2 : 4) + behindCatchup;
                        if (manualVegBehindCursor >= minSample) {
                            manualVegBehindCursor = fillManualVegetation(manualVegBehindCursor, minSample, behindBudget);
                        }
                        if (vegWarmup > 0) vegWarmup--;
                    }
                }

                 const speedFactor = Math.min(realSpeed * 1.5, 2.0);
                 const time = Date.now() * 0.001;
                 tmpFinalPos.copy(basePos);
                 carModel.position.copy(tmpFinalPos);
                 updateHudDistance();
                 
                 if (!isManualControl) {
                     curve.getTangentAt(carT, tmpCurveTangent).normalize();
                     tmpScrollSide.crossVectors(tmpCurveTangent, yAxis).normalize();
                     tmpRoadNormal.crossVectors(tmpScrollSide, tmpCurveTangent).normalize();
                     if (tmpRoadNormal.y < 0) tmpRoadNormal.negate();
                     carModel.up.copy(tmpRoadNormal);
                 }
                 
                 const scaleFreq = 10;
                 const scaleAmp = speedFactor * 0.1; 

                 const scaleXZ = 1 - Math.sin(time * scaleFreq) * (scaleAmp * 0.5); 
                 
                 const scaleVibX = (Math.random() - 0.5) * scaleAmp;
                 const scaleVibZ = (Math.random() - 0.5) * scaleAmp;

                 const baseScale = 6;
                 carModel.scale.set(
                    baseScale * (scaleXZ + scaleVibX), 
                    baseScale, 
                    baseScale * (scaleXZ + scaleVibZ)
                 );

                 if (roadMaterial.userData.uniforms) {
                    roadMaterial.userData.uniforms.carPos.value.copy(tmpFinalPos);
                    if (roadMaterial.userData.uniforms.carDir) {
                        carModel.getWorldDirection(tmpForwardDir);
                        tmpForwardDir.y = 0;
                        if (tmpForwardDir.lengthSq() > 1e-8) tmpForwardDir.normalize();
                        else tmpForwardDir.set(0, 0, -1);
                        roadMaterial.userData.uniforms.carDir.value.set(tmpForwardDir.x, tmpForwardDir.z);
                    }
                 }
                 
                 const localBack = tmpDesiredDir.set(0, 0, 1).applyQuaternion(carModel.quaternion);

                let spawnChance = 0;

                const isMovingForward = isManualControl
                    ? (manualVelocity.dot(streetForwardSmoothed) > 0.01)
                    : (deltaT > 0.0001);
                if (isMovingForward && realSpeed > 0.01) {
                    spawnChance = 0.1 + (realSpeed * 0.5);
                } else {
                    spawnChance = 0;
                }
                 
                 if (Math.random() < spawnChance) {
                     const p = particlePool.acquire();
                     if (p) {
                         p.maxLife = 1.0 + Math.random() * 0.5;
                         p.life = p.maxLife;
                         
                         tmpSpawnPos.copy(tmpFinalPos).addScaledVector(localBack, 2.5);
                         p.mesh.position.copy(tmpSpawnPos);
                         
                         p.mesh.position.x += (Math.random() - 0.5) * 0.3;
                         p.mesh.position.z += (Math.random() - 0.5) * 0.3;
                         
                         p.mesh.scale.set(1, 1, 1);
                         
                         const gray = 0.5 + Math.random() * 0.5; 
                         p.mesh.material.color.setScalar(gray);
                         activeParticles.push(p);
                     }
                 }
                 
                 for (let i = activeParticles.length - 1; i >= 0; i--) {
                     const p = activeParticles[i];
                     p.life -= 0.03 * timeScale;
                     if (p.life <= 0) {
                         activeParticles.splice(i, 1);
                         particlePool.release(p);
                     } else {
                         p.mesh.position.y += 0.02 * timeScale;
                         const lifeRatio = p.life / p.maxLife;
                         const scale = 3 * lifeRatio * (1 - lifeRatio);
                         const s = scale * 2.5;
                         p.mesh.scale.set(s, s, s);
                     }
                }
            }

            if (isManualControl) {
                tmpCamDir.copy(streetForwardSmoothed);
                tmpCamDir.y = 0;
                if (tmpCamDir.lengthSq() > 1e-8) tmpCamDir.normalize();
                else tmpCamDir.set(0, 0, -1);
                tmpCamOffset.copy(tmpCamDir).multiplyScalar(-15);
                tmpCamOffset.y += 5;
                cameraTargetPos.copy(manualPosition).add(tmpCamOffset);
                tmpCamLookOffset.copy(tmpCamDir).multiplyScalar(20);
                cameraTargetLookAt.copy(manualPosition).add(tmpCamLookOffset);
            } else {
                const camPos = curve.getPointAt(currentT);
                const lookAtPos = curve.getPointAt(Math.min(1, currentT + 0.05)); 
                
                cameraTargetPos.copy(camPos);
                cameraTargetPos.y += 2.5;
                
                cameraTargetLookAt.set(lookAtPos.x, lookAtPos.y - 2 + 1, lookAtPos.z);
            }

            if (isManualControl && !wasManualControl) {
                cameraBlend = 0;
                cameraFromPos.copy(camera.position);
                cameraFromLookAt.copy(cameraLookAtCurrent);
            }

            if (isManualControl) {
                cameraBlend = Math.min(1, cameraBlend + dt * 3);
                camera.position.lerpVectors(cameraFromPos, cameraTargetPos, cameraBlend);
                cameraLookAtCurrent.lerpVectors(cameraFromLookAt, cameraTargetLookAt, cameraBlend);
            } else {
                cameraBlend = 1;
                camera.position.copy(cameraTargetPos);
                cameraLookAtCurrent.copy(cameraTargetLookAt);
            }

            camera.lookAt(cameraLookAtCurrent);
            wasManualControl = isManualControl;

            if (!isEndlessRunner && markerInfo.length > 0) {
                const infoT = carModel ? manualRoadT : currentT;
                let bestIndex = 0;
                let bestDist = Infinity;
                for (let i = 0; i < markerInfo.length; i++) {
                    const d = Math.abs(markerInfo[i].t - infoT);
                    if (d < bestDist) {
                        bestDist = d;
                        bestIndex = i;
                    }
                }
                setActiveInfo(bestIndex);
            } else {
                setActiveInfo(null);
            }
            
            objects.forEach(obj => {
                const dist = obj.position.distanceTo(camera.position);
                
                const fadeStart = 50;
                const fadeEnd = 90;
                
                let opacity = 1;
                
                if (dist > fadeStart) {
                    opacity = 1 - (dist - fadeStart) / (fadeEnd - fadeStart);
                    opacity = Math.max(0, Math.min(1, opacity));
                }

                setOpacity(obj, opacity);
            });

            renderer.render(scene, camera);
        }

        animate();

        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                updateRendererSize();
            }
            updateProgressInnerLayout();
        });
        resizeObserver.observe(container);
        queueMicrotask(() => {
            if (!loadingBegan && !destroyed) revealWhenReady();
        });

        const destroy = () => {
            if (destroyed) return;
            destroyed = true;

            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            scrollContainer.removeEventListener('scroll', updateScroll);
            dragOverlay.removeEventListener('pointerdown', onDragPointerDown);
            dragOverlay.removeEventListener('pointermove', onDragPointerMove);
            dragOverlay.removeEventListener('pointerup', endDrag);
            dragOverlay.removeEventListener('pointercancel', endDrag);
            dragOverlay.removeEventListener('wheel', onDragWheel);
            resizeObserver.disconnect();
            if (revealFallbackTimer) {
                clearTimeout(revealFallbackTimer);
                revealFallbackTimer = 0;
            }

            if (rafId) cancelAnimationFrame(rafId);

            scene.traverse((obj) => {
                if (obj.isMesh) {
                    if (obj.geometry) obj.geometry.dispose();
                    const mat = obj.material;
                    if (Array.isArray(mat)) {
                        for (const m of mat) {
                            if (m && m.map) m.map.dispose();
                            if (m) m.dispose();
                        }
                    } else if (mat) {
                        if (mat.map) mat.map.dispose();
                        mat.dispose();
                    }
                }
            });

            if (roadTexture) roadTexture.dispose();
            renderer.dispose();

            if (renderer.domElement && renderer.domElement.parentNode) {
                renderer.domElement.parentNode.removeChild(renderer.domElement);
            }

            if (uiRoot && uiRoot.parentNode) {
                uiRoot.parentNode.removeChild(uiRoot);
            }

            container.innerHTML = '';
        };

        return { destroy };
    } catch (e) {
        console.error("Error initializing 3D timeline:", e);
        container.innerHTML = "Error initializing 3D view: " + e.message;
        container.style.opacity = '1';
        return null;
    }
}

function createRoadGeometry(curve, segments, width) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const uvs = [];
    const indices = [];

    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const point = curve.getPointAt(t);
        const tangent = curve.getTangentAt(t).normalize();
        
        const side = new THREE.Vector3().crossVectors(tangent, up).normalize().multiplyScalar(width / 2);
        
        const left = new THREE.Vector3().copy(point).add(side);
        const right = new THREE.Vector3().copy(point).sub(side);
        
        vertices.push(left.x, left.y, left.z);
        vertices.push(right.x, right.y, right.z);
        
        const v = i / segments; 
        uvs.push(0, v);
        uvs.push(1, v);
    }

    for (let i = 0; i < segments; i++) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
}

function createRoadTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#333333';
    ctx.fillRect(0, 0, 2048, 2048);
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(40, 0, 40, 2048);
    ctx.fillRect(1968, 0, 40, 2048);
    
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 32;
    ctx.setLineDash([128, 128]);
    ctx.beginPath();
    ctx.moveTo(1024, 0);
    ctx.lineTo(1024, 2048);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';

    for(let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = context.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
            context.fillText(line, x, y);
            line = words[n] + ' ';
            y += lineHeight;
        } else {
            line = testLine;
        }
    }
    context.fillText(line, x, y);
}

function createTextTexture(text, options = {}) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const width = options.width || 256;
    const height = options.height || 128;
    canvas.width = width;
    canvas.height = height;
    
    ctx.font = `bold ${options.fontSize || 40}px Arial`;
    ctx.fillStyle = options.color || 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    ctx.fillText(text, width/2, height/2);
    
    return new THREE.CanvasTexture(canvas);
}

function createMileMarkerTexture(year, label, options = {}) {
    const width = options.width ?? 360;
    const cleanYear = String(year ?? '').trim();
    const cleanLabel = String(label ?? '').replace(/\s+/g, ' ').trim();

    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');

    const padX = Math.max(20, Math.round(width * 0.12));
    const basePadY = Math.max(18, Math.round(width * 0.08));
    const innerWidth = Math.max(1, width - padX * 2);

    const wrapWithFont = (ctx, text, maxWidth) => {
        const raw = String(text ?? '').trim();
        if (!raw) return [];
        const words = raw.split(' ');
        const lines = [];
        let line = '';

        const pushLine = (value) => {
            const trimmed = value.trim();
            if (trimmed) lines.push(trimmed);
        };

        const breakLongWord = (word) => {
            let chunk = '';
            for (const ch of word) {
                const next = chunk + ch;
                if (ctx.measureText(next).width > maxWidth && chunk) {
                    pushLine(chunk);
                    chunk = ch;
                } else {
                    chunk = next;
                }
            }
            pushLine(chunk);
        };

        for (const word of words) {
            const test = line ? `${line} ${word}` : word;
            if (ctx.measureText(test).width <= maxWidth) {
                line = test;
                continue;
            }
            if (line) pushLine(line);
            line = '';
            if (ctx.measureText(word).width <= maxWidth) line = word;
            else breakLongWord(word);
        }
        if (line) pushLine(line);
        return lines;
    };

    let yearSize = Math.max(34, Math.round(width * 0.24));
    measureCtx.font = `800 ${yearSize}px Arial`;
    while (yearSize > 34 && measureCtx.measureText(cleanYear).width > innerWidth) {
        yearSize -= 2;
        measureCtx.font = `800 ${yearSize}px Arial`;
    }

    const gap = Math.max(10, Math.round(width * 0.06));
    const yearBlockHeight = yearSize * 1.15;

    let labelSize = 0;
    let labelLines = [];
    if (cleanLabel) {
        labelSize = Math.max(48, Math.round(width * 0.11));
        measureCtx.font = `700 ${labelSize}px Arial`;
        labelLines = wrapWithFont(measureCtx, cleanLabel, innerWidth);
    }

    const lineHeight = labelSize ? labelSize * 1.16 : 0;
    const labelBlockHeight = labelLines.length ? (labelLines.length * lineHeight) : 0;
    const padY = Math.max(basePadY, Math.round((yearSize + (labelSize || 0)) * 0.35));
    const contentHeight = cleanLabel ? (yearBlockHeight + gap + labelBlockHeight) : yearBlockHeight;
    const height = Math.round(padY * 2 + contentHeight);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0b5d1e';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';

    const borderWidth = Math.max(5, Math.round(width * 0.03));
    const cornerRadius = Math.max(10, Math.round(width * 0.12));

    const x0 = borderWidth * 0.5;
    const y0 = borderWidth * 0.5;
    const w = width - borderWidth;
    const h = height - borderWidth;
    const r = Math.min(cornerRadius, w * 0.5, h * 0.5);

    ctx.beginPath();
    ctx.moveTo(x0 + r, y0);
    ctx.arcTo(x0 + w, y0, x0 + w, y0 + h, r);
    ctx.arcTo(x0 + w, y0 + h, x0, y0 + h, r);
    ctx.arcTo(x0, y0 + h, x0, y0, r);
    ctx.arcTo(x0, y0, x0 + w, y0, r);
    ctx.closePath();
    ctx.fill();

    ctx.lineWidth = borderWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    const cx = width * 0.5;
    const yearBaseline = padY + yearSize;
    ctx.font = `800 ${yearSize}px Arial`;
    ctx.fillText(cleanYear, cx, yearBaseline);

    if (cleanLabel && labelLines.length) {
        ctx.font = `700 ${labelSize}px Arial`;
        let y = yearBaseline + gap + labelSize;
        for (let i = 0; i < labelLines.length; i++) {
            ctx.fillText(labelLines[i], cx, y);
            y += lineHeight;
        }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.userData = tex.userData || {};
    tex.userData.cornerRadius01 = width > 0 ? (r / width) : 0;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
}

function createRoundedRectShape(width, height, radius) {
    const w = width;
    const h = height;
    const r = Math.max(0, Math.min(radius, w * 0.5, h * 0.5));
    const x = -w * 0.5;
    const y = -h * 0.5;
    const shape = new THREE.Shape();
    shape.moveTo(x + r, y);
    shape.lineTo(x + w - r, y);
    shape.quadraticCurveTo(x + w, y, x + w, y + r);
    shape.lineTo(x + w, y + h - r);
    shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    shape.lineTo(x + r, y + h);
    shape.quadraticCurveTo(x, y + h, x, y + h - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);
    return shape;
}

function normalizeShapeUvs(geometry) {
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox;
    if (!bb) return;
    const minX = bb.min.x;
    const minY = bb.min.y;
    const rangeX = Math.max(1e-8, bb.max.x - bb.min.x);
    const rangeY = Math.max(1e-8, bb.max.y - bb.min.y);

    const pos = geometry.getAttribute('position');
    if (!pos) return;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        uv[i * 2] = (x - minX) / rangeX;
        uv[i * 2 + 1] = (y - minY) / rangeY;
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function applyFadeToMaterial(material) {
    material.transparent = true;
    const signShadowMax = material.userData?.signShadowMax;
    const hasSignShadows = typeof signShadowMax === 'number' && Number.isFinite(signShadowMax) && signShadowMax > 0;
    if (hasSignShadows) {
        material.defines = material.defines || {};
        material.defines.SIGN_SHADOW_MAX = Math.max(1, Math.floor(signShadowMax));
        material.userData.uniforms = material.userData.uniforms || {};
        if (!material.userData.uniforms.signCount) material.userData.uniforms.signCount = { value: 0 };
        if (!material.userData.uniforms.signPos) material.userData.uniforms.signPos = { value: material.userData.signShadowPositions || [] };
    }
    material.onBeforeCompile = (shader) => {
        if (hasSignShadows) {
            shader.uniforms.signCount = material.userData.uniforms.signCount;
            shader.uniforms.signPos = material.userData.uniforms.signPos;

            shader.vertexShader = `
                varying vec3 vWorldPosition;
                ${shader.vertexShader}
            `;

            shader.vertexShader = shader.vertexShader.replace(
                '#include <project_vertex>',
                `
                vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
                vWorldPosition = worldPosition.xyz;
                #include <project_vertex>
                `
            );

            shader.fragmentShader = `
                uniform int signCount;
                uniform vec3 signPos[SIGN_SHADOW_MAX];
                varying vec3 vWorldPosition;
                ${shader.fragmentShader}
            `;
        }
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            `
            #include <dithering_fragment>
            ${hasSignShadows ? `
            float signShadow = 0.0;
            for (int i = 0; i < SIGN_SHADOW_MAX; i++) {
                if (i < signCount) {
                    vec2 rel = vWorldPosition.xz - signPos[i].xz;
                    float d = length(rel);
                    float radius = 0.525;
                    float soft = 0.35;
                    float s = 1.0 - smoothstep(radius, radius + soft, d);
                    signShadow = max(signShadow, s);
                }
            }
            gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * 0.55, signShadow * 0.6);
            ` : ''}
            float dist = gl_FragCoord.z / gl_FragCoord.w;
            float fadeStart = 50.0;
            float fadeEnd = 90.0;
            float alpha = 1.0 - smoothstep(fadeStart, fadeEnd, dist);
            gl_FragColor.a *= alpha;
            `
        );
    };
}

function applyRoadShader(material) {
    material.transparent = true;
    material.userData.uniforms = {
        carPos: { value: new THREE.Vector3() },
        carDir: { value: new THREE.Vector2(0, -1) }
    };
    
    material.onBeforeCompile = (shader) => {
        shader.uniforms.carPos = material.userData.uniforms.carPos;
        shader.uniforms.carDir = material.userData.uniforms.carDir;
        
        shader.vertexShader = `
            varying vec3 vWorldPosition;
            ${shader.vertexShader}
        `;
        
        shader.vertexShader = shader.vertexShader.replace(
            '#include <project_vertex>',
            `
            vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
            vWorldPosition = worldPosition.xyz;
            #include <project_vertex>
            `
        );
        
        shader.fragmentShader = `
            uniform vec3 carPos;
            uniform vec2 carDir;
            varying vec3 vWorldPosition;
            ${shader.fragmentShader}
        `;
        
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            `
            #include <dithering_fragment>
            
            vec2 rel = vWorldPosition.xz - carPos.xz;
            vec2 f = normalize(carDir);
            vec2 r = vec2(f.y, -f.x);
            vec2 local = vec2(dot(rel, r), dot(rel, f));

            vec2 halfSize = vec2(1.3, 2.2);
            vec2 q = abs(local) - halfSize;
            float outside = length(max(q, vec2(0.0)));
            float inside = min(max(q.x, q.y), 0.0);
            float boxDist = outside + inside;

            float shadowSoft = 0.01;
            float shadow = 1.0 - smoothstep(0.0, shadowSoft, max(boxDist, 0.0));
            gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * 0.55, shadow * 0.85);
            
            float depth = gl_FragCoord.z / gl_FragCoord.w;
            float fadeStart = 50.0;
            float fadeEnd = 90.0;
            float alpha = 1.0 - smoothstep(fadeStart, fadeEnd, depth);
            gl_FragColor.a *= alpha;
            `
        );
    };
}
