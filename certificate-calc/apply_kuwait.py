# Apply all Kuwait certificate changes to index.html

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. CSS dark theme - glow-emerald
content = content.replace(
    '--glow-pink: 0 0 25px rgba(236,72,153,0.3);\n            --toggle-bg: #1a1d2e;',
    '--glow-pink: 0 0 25px rgba(236,72,153,0.3);\n            --glow-emerald: 0 0 25px rgba(16,185,129,0.3);\n            --toggle-bg: #1a1d2e;'
)

# 2. CSS light theme - glow-emerald
content = content.replace(
    '--glow-pink: 0 0 25px rgba(219,39,119,0.15);\n            --toggle-bg: #ffffff;',
    '--glow-pink: 0 0 25px rgba(219,39,119,0.15);\n            --glow-emerald: 0 0 25px rgba(5,150,105,0.15);\n            --toggle-bg: #ffffff;'
)

# 3. CSS kuwait tab style
content = content.replace(
    '.tab-glow.azhar-tab.active { background: rgba(236,72,153,0.12); border-color: rgba(236,72,153,0.5); color: var(--accent-pink); box-shadow: var(--glow-pink); }\n\n        .card-main {',
    '.tab-glow.azhar-tab.active { background: rgba(236,72,153,0.12); border-color: rgba(236,72,153,0.5); color: var(--accent-pink); box-shadow: var(--glow-pink); }\n        .tab-glow.kuwait-tab.active { background: rgba(16,185,129,0.12); border-color: rgba(16,185,129,0.5); color: var(--accent-emerald); box-shadow: var(--glow-emerald); }\n\n        .card-main {'
)

# 4. Equivalent score card + Kuwait tab button in HTML
content = content.replace(
    '<button class="btn-new-cert" onclick="resetAllFields()"><i class="fas fa-sync-alt me-1"></i> \u0634\u0647\u0627\u062f\u0629 \u062c\u062f\u064a\u062f\u0629</button>\n        </div>\n\n        <div class="tabs-wrapper">\n            <button class="tab-glow american-tab active" data-tab="american"><i class="fas fa-flag-usa me-1"></i> \u0627\u0644\u0623\u0645\u0631\u064a\u0643\u064a\u0629</button>\n            <button class="tab-glow thanaweya-tab" data-tab="thanaweya"><i class="fas fa-graduation-cap me-1"></i> \u0627\u0644\u062b\u0627\u0646\u0648\u064a\u0629</button>\n            <button class="tab-glow gulf-tab" data-tab="gulf"><i class="fas fa-globe-asia me-1"></i> \u0639\u0645\u0627\u0646-\u0642\u0637\u0631-\u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062a</button>\n            <button class="tab-glow libya-tab" data-tab="libya"><i class="fas fa-map-pin me-1"></i> \u0644\u064a\u0628\u064a\u0627</button>\n            <button class="tab-glow jordan-tab" data-tab="jordan"><i class="fas fa-map-pin me-1"></i> \u0627\u0644\u0623\u0631\u062f\u0646</button>\n            <button class="tab-glow azhar-tab" data-tab="azhar"><i class="fas fa-book-quran me-1"></i> \u0623\u0632\u0647\u0631\u064a\u0629</button>\n        </div>',
    '<div class="score-card" id="equivalentScoreItem">\n                <div class="score-label">\u0627\u0644\u0645\u062c\u0645\u0648\u0639 \u0627\u0644\u0645\u0643\u0627\u0641\u064a</div>\n                <div class="score-value" id="equivalentScoreDisplay" style="color:var(--accent-amber);">0</div>\n            </div>\n            <button class="btn-new-cert" onclick="resetAllFields()"><i class="fas fa-sync-alt me-1"></i> \u0634\u0647\u0627\u062f\u0629 \u062c\u062f\u064a\u062f\u0629</button>\n        </div>\n\n        <div class="tabs-wrapper">\n            <button class="tab-glow american-tab active" data-tab="american"><i class="fas fa-flag-usa me-1"></i> \u0627\u0644\u0623\u0645\u0631\u064a\u0643\u064a\u0629</button>\n            <button class="tab-glow thanaweya-tab" data-tab="thanaweya"><i class="fas fa-graduation-cap me-1"></i> \u0627\u0644\u062b\u0627\u0646\u0648\u064a\u0629</button>\n            <button class="tab-glow gulf-tab" data-tab="gulf"><i class="fas fa-globe-asia me-1"></i> \u0639\u0645\u0627\u0646-\u0642\u0637\u0631-\u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062a</button>\n            <button class="tab-glow libya-tab" data-tab="libya"><i class="fas fa-map-pin me-1"></i> \u0644\u064a\u0628\u064a\u0627</button>\n            <button class="tab-glow jordan-tab" data-tab="jordan"><i class="fas fa-map-pin me-1"></i> \u0627\u0644\u0623\u0631\u062f\u0646</button>\n            <button class="tab-glow azhar-tab" data-tab="azhar"><i class="fas fa-book-quran me-1"></i> \u0623\u0632\u0647\u0631\u064a\u0629</button>\n            <button class="tab-glow kuwait-tab" data-tab="kuwait"><i class="fas fa-flag me-1"></i> \u0627\u0644\u0643\u0648\u064a\u062a</button>\n        </div>'
)

# 5. State + DOM refs + tab mapping
content = content.replace(
    'kuwaitGrade10:Array(8).fill(""),kuwaitGrade11:Array(8).fill(""),kuwaitGrade12:Array(8).fill(""),methodOpen',
    'methodOpen'
)

content = content.replace(
    'azharCultural:"",methodOpen:!1,est1Percent:0,est2Percent:0,gpaPercent:0};',
    'azharCultural:"",kuwaitGrade10:Array(8).fill(""),kuwaitGrade11:Array(8).fill(""),kuwaitGrade12:Array(8).fill(""),methodOpen:!1,est1Percent:0,est2Percent:0,gpaPercent:0};'
)

content = content.replace(
    'const e=document.getElementById("tabContent"),t=document.getElementById("rawScoreDisplay"),n=document.getElementById("finalPercentage"),o=document.getElementById("rawScoreItem");',
    'const e=document.getElementById("tabContent"),t=document.getElementById("rawScoreDisplay"),n=document.getElementById("finalPercentage"),o=document.getElementById("rawScoreItem"),Eeq=document.getElementById("equivalentScoreDisplay"),EeqItem=document.getElementById("equivalentScoreItem");'
)

content = content.replace(
    'const a={american:"american-tab",thanaweya:"thanaweya-tab",gulf:"gulf-tab",libya:"libya-tab",jordan:"jordan-tab",azhar:"azhar-tab"};',
    'const a={american:"american-tab",thanaweya:"thanaweya-tab",gulf:"gulf-tab",libya:"libya-tab",jordan:"jordan-tab",azhar:"azhar-tab",kuwait:"kuwait-tab"};'
)

# 6. Add kuwaitGradeData and kuwaitCalc after function d
content = content.replace(
    'function d(){const e=(parseFloat(s.azharArabic)||0)+(parseFloat(s.azharCultural)||0);return"sci"===s.azharPath?e/4.4:"420"===s.azharLitSys?e/4.2:e/3.8}\nfunction p(){const e=document.getElementById("est1TotalDisplay")',
    'function d(){const e=(parseFloat(s.azharArabic)||0)+(parseFloat(s.azharCultural)||0);return"sci"===s.azharPath?e/4.4:"420"===s.azharLitSys?e/4.2:e/3.8}\nfunction kuwaitGradeData(g){const m={10:[60,60,80,60,60,40,40,20],11:[80,80,20,100,80,80,60,60],12:[80,80,100,80,80,80,20,0]},k={10:"kuwaitGrade10",11:"kuwaitGrade11",12:"kuwaitGrade12"},a=s[k[g]].map(e=>parseFloat(e)||0),i=m[g],r=a.reduce((e,t)=>e+t,0),u=i.reduce((e,t)=>e+t,0),l=u>0?r/u*100:0;return{sum:r,maxSum:u,pct:l}}\nfunction kuwaitCalc(){const e=kuwaitGradeData(10),t=kuwaitGradeData(11),n=kuwaitGradeData(12);return e.pct/100*10+t.pct/100*20+n.pct/100*70}\nfunction p(){const e=document.getElementById("est1TotalDisplay")'
)

# 7. Update m() - add kuwait case and equivalent score
old_m = 'function m(){const a=(()=>{switch(s.activeTab){case"american":return g();case"thanaweya":return h();case"gulf":return u();case"libya":return l();case"jordan":return c();case"azhar":return d();default:return 0}})();n.textContent=a.toFixed(1)+"%";let e=null;switch(s.activeTab){case"thanaweya":e=parseFloat(s.thScore)||0;break;case"gulf":e=s.gulfSubjects.reduce((e,t)=>t.isStar?e+50:e+(parseFloat(t.mark)||0),0);break;case"libya":e=s.libyaSubjects.reduce((e,t)=>e+(parseFloat(t)||0),0);break;case"jordan":e=s.jordanSubjects.reduce((e,t)=>e+(parseFloat(t)||0),0);break;case"azhar":e=(parseFloat(s.azharArabic)||0)+(parseFloat(s.azharCultural)||0)}null!==e?(o.style.display="",t.textContent=e):o.style.display="none",p()}'
new_m = 'function m(){const a=(()=>{switch(s.activeTab){case"american":return g();case"thanaweya":return h();case"gulf":return u();case"libya":return l();case"jordan":return c();case"azhar":return d();case"kuwait":return kuwaitCalc();default:return 0}})();n.textContent=a.toFixed(1)+"%";let e=null;switch(s.activeTab){case"thanaweya":e=parseFloat(s.thScore)||0;break;case"gulf":e=s.gulfSubjects.reduce((e,t)=>t.isStar?e+50:e+(parseFloat(t.mark)||0),0);break;case"libya":e=s.libyaSubjects.reduce((e,t)=>e+(parseFloat(t)||0),0);break;case"jordan":e=s.jordanSubjects.reduce((e,t)=>e+(parseFloat(t)||0),0);break;case"azhar":e=(parseFloat(s.azharArabic)||0)+(parseFloat(s.azharCultural)||0);break;case"kuwait":const g10=kuwaitGradeData(10),g11=kuwaitGradeData(11),g12=kuwaitGradeData(12);e=g10.sum+g11.sum+g12.sum}null!==e?(o.style.display="",t.textContent=e,Eeq.textContent=(e*4.1).toFixed(1),EeqItem.style.display=""):(o.style.display="none",EeqItem.style.display="none"),p()}'
content = content.replace(old_m, new_m)

# 8. Update f() - add kuwait case
content = content.replace(
    'case"azhar":t=w()}e.innerHTML=t,k(),m()}',
    'case"azhar":t=w();break;case"kuwait":t=kuwaitRender()}e.innerHTML=t,k(),m()}'
)

# 9. Add kuwaitRender function after w() 
old_w_end = '</div></div>`}\nwindow.toggleMethod=function'
kuwait_render = '''</div></div>`}
function kuwaitRender(){const g10s=["عربي","انجليزي","الرياضيات","كيمياء","فيزياء","احياء","جيولوجيا","معلوماتيه"],g10max=[60,60,80,60,60,40,40,20],g11s=["عربي","انجليزي","معلوماتيه","الرياضيات","فيزياء","كيمياء","احياء","جيولوجيا"],g11max=[80,80,20,100,80,80,60,60],g12s=["عربي","انجليزي","الرياضيات","كيمياء","فيزياء","احياء","معلوماتيه","دستور وحقوق انسان"],g12max=[80,80,100,80,80,80,20,0];const ks={10:"kuwaitGrade10",11:"kuwaitGrade11",12:"kuwaitGrade12"},grades=[{n:"الصف العاشر",subs:g10s,maxs:g10max,key:10},{n:"الصف الحادي عشر",subs:g11s,maxs:g11max,key:11},{n:"الصف الثاني عشر",subs:g12s,maxs:g12max,key:12}];let html="";for(const g of grades){const marks=s[ks[g.key]].map(v=>parseFloat(v)||0);const sum=marks.reduce((a,b)=>a+b,0);const maxSum=g.maxs.reduce((a,b)=>a+b,0);const pct=maxSum>0?sum/maxSum*100:0;const wt=g.key===10?10:g.key===11?20:70;html+=`<div class="card-main"><div class="section-header-row"><div class="card-heading mb-0"><span class="dot-accent" style="background:var(--accent-emerald);"></span> ${g.n}</div><span class="percent-chip gpa">${pct.toFixed(1)}%</span></div>`;for(let i=0;i<8;i++){html+=`<div class="d-flex align-items-center gap-2 mb-2 p-2" style="background:var(--bg-input);border:1px solid var(--border);border-radius:12px;"><span style="min-width:55px;font-weight:700;color:var(--text-label);font-size:0.75rem;">${g.subs[i]}</span><input class="input-main flex-grow-1 enter-next text-center" data-field="kuwaitGrade${g.key}[${i}]" value="${s[ks[g.key]][i]}" placeholder="0" style="font-weight:800;border-radius:8px;"><span style="min-width:40px;text-align:center;font-weight:700;color:var(--text-muted);font-family:'Changa',sans-serif;font-size:0.82rem;direction:ltr;">${g.maxs[i]>0?"/ "+g.maxs[i]:""}</span></div>`}html+=`<div class="total-box mt-3"><span>المجموع: <strong>${sum}</strong> / ${maxSum} | النسبة: <strong>${pct.toFixed(1)}%</strong> | الوزن النسبي: <strong>${wt}%</strong></span><span class="total-highlight-num">${(pct/100*wt).toFixed(1)}%</span></div></div>`}html+=C("طريقة حساب الشهادة الكويتية","<ul><li>تحذف المواد الإسلامية من الصف العاشر والحادي عشر والثاني عشر.</li><li>لكل صف: تجمع درجات الطالب وتقسم على مجموع النهاية العظمى وتضرب × 100.</li><li>المعدل التراكمي = النسبة % ÷ 100 × الوزن النسبي للصف.</li><li><strong>وزن الصف العاشر: 10% - الحادي عشر: 20% - الثاني عشر: 70%</strong></li><li>النسبة العامة = مجموع المعدلات التراكمية للأصف الثلاثة.</li></ul>");return html}
window.toggleMethod=function'''
content = content.replace(old_w_end, kuwait_render)

# 10. Update T() - add kuwait field parsing
content = content.replace(
    'o.gulfSubjects[i].isStar=t)}',
    'o.gulfSubjects[i].isStar=t)}else if(e.startsWith("kuwaitGrade")){let a=parseInt(e.match(/\[(\d+)\]/)[1]),c=e.match(/kuwaitGrade(\d+)/)[1];o["kuwaitGrade"+c][a]=t}'
)

# 11. Update resetAllFields()
content = content.replace(
    's.azharPath="sci",s.azharLitSys="420",s.azharArabic="",s.azharCultural="",s.amPath="non_eng",s.methodOpen=!1,s.est1Percent=0,s.est2Percent=0,s.gpaPercent=0,s.amHas9th=!1,s.amSubjects9="",f()',
    's.azharPath="sci",s.azharLitSys="420",s.azharArabic="",s.azharCultural="",s.kuwaitGrade10=Array(8).fill(""),s.kuwaitGrade11=Array(8).fill(""),s.kuwaitGrade12=Array(8).fill(""),s.amPath="non_eng",s.methodOpen=!1,s.est1Percent=0,s.est2Percent=0,s.gpaPercent=0,s.amHas9th=!1,s.amSubjects9="",f()'
)

# Also need to fix the state object - we already added kuwait state after azharCultural
# But check if it was already there (from step 5) or needs to be added now

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("All changes applied successfully!")
