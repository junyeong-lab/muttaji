/* Privacy-preserving image preparation for on-device text recognition.
 * Recognize table columns independently; do not infer any text/requirements.
 */
(function(root, factory) {
  "use strict";
  const tools = factory();
  if (typeof module === "object" && module.exports) module.exports = tools;
  if (root) root.MuttajiOcrImage = tools;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function gray(r,g,b){return 0.299*r + 0.587*g + 0.114*b;}
  function segmentationMode(mode){return mode==="single-block"?"6":"4";}
  function lowResolution(width,height){
    return Number.isFinite(width)&&Number.isFinite(height)&&
      width>0&&height>0&&(width<1100||height<320);
  }
  function inspect(pixels, width, height) {
    if (!pixels || !width || !height) throw new TypeError("Invalid image data");
    let left=width,top=height,right=-1,bottom=-1,dark=0;
    // Detect readable dark text, not faint table gridlines or white margins.
    for(let y=0; y<height; y++){
      for(let x=0; x<width; x++){
        const i=(y*width+x)*4;
        if(pixels[i+3]<100)continue;
        if(gray(pixels[i],pixels[i+1],pixels[i+2])<190){
          if(x<left)left=x;if(x>right)right=x;
          if(y<top)top=y;if(y>bottom)bottom=y;
          dark++;
        }
      }
    }
    if (right<left || bottom<top) {
      return {regions:[{x:0,y:0,width,height}],columns:1,cropped:false,blank:true};
    }
    const contentArea=(right-left+1)*(bottom-top+1);
    // Do not treat dense pictures/gradients as a table.
    const photoLike=dark>width*height*.24;
    const gridLines=[];
    if(!photoLike && contentArea > 5000 && bottom-top >= 50){
      for(let x=left+20; x<right-20; x++){
        let grayCount=0, rows=0;
        for(let y=Math.max(0,top-2); y<=Math.min(height-1,bottom+2);y+=2){
          const i=(y*width+x)*4;
          if(pixels[i+3]<100)continue;
          rows++;
          const r=pixels[i],g=pixels[i+1],b=pixels[i+2];
          const brightness=gray(r,g,b);
          if(brightness>=145 && brightness<249 && Math.max(r,g,b)-Math.min(r,g,b)<13)grayCount++;
        }
        if(rows>0 && grayCount/rows>.78 && (!gridLines.length || x-gridLines[gridLines.length-1]>3))gridLines.push(x);
      }
    }
    const margin=12;
    const lx=Math.max(0,left-margin), rx=Math.min(width,right+margin+1);
    const ty=Math.max(0,top-margin), by=Math.min(height,bottom+margin+1);
    let regions=[];
    const candidates=[lx].concat(gridLines).concat([rx]);
    if(gridLines.length>=1 && gridLines.length<=6){
      for(let i=0;i<candidates.length-1;i++){
        const a=Math.max(lx,candidates[i]+(i?4:0));
        const b=Math.min(rx,candidates[i+1]-(i<gridLines.length?4:0));
        if(b-a<25)continue;
        let rleft=width,rtop=height,rright=-1,rbottom=-1;
        for(let y=top; y<=bottom;y++){
          for(let x=a;x<b;x++){
            const j=(y*width+x)*4;
            if(pixels[j+3]>=100 && gray(pixels[j],pixels[j+1],pixels[j+2])<190){
              if(x<rleft)rleft=x;if(x>rright)rright=x;
              if(y<rtop)rtop=y;if(y>rbottom)rbottom=y;
            }
          }
        }
        if(rright<rleft || rbottom<rtop || (rright-rleft<5 && rbottom-rtop<5))continue;
        regions.push({
          x:Math.max(a,rleft-7), y:Math.max(0,rtop-9),
          width:Math.min(b,rright+8)-Math.max(a,rleft-7),
          height:Math.min(height,rbottom+10)-Math.max(0,rtop-9)
        });
      }
    }
    if(regions.length<2){
      regions=[{x:lx,y:ty,width:rx-lx,height:by-ty}];
    }
    // Avoid creating very large Tesseract canvases on low-memory mobiles.
    return {regions,columns:regions.length,cropped:lx!==0||rx!==width||ty!==0||by!==height,blank:false};
  }

  function upscale(source,rect,enhance){
    const scale=Math.max(1,Math.min(3,2400/rect.width,2400/rect.height));
    const padding=18;
    const canvas=document.createElement("canvas");
    canvas.width=Math.ceil(rect.width*scale+padding*2);
    canvas.height=Math.ceil(rect.height*scale+padding*2);
    const ctx=canvas.getContext("2d",{willReadFrequently:!!enhance});
    ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
    ctx.drawImage(source,rect.x,rect.y,rect.width,rect.height,padding,padding,rect.width*scale,rect.height*scale);
    if(enhance){
      const data=ctx.getImageData(0,0,canvas.width,canvas.height);
      const p=data.data;
      for(let i=0;i<p.length;i+=4){
        const v=gray(p[i],p[i+1],p[i+2]);
        const contrast=v<=165?0:v>=245?255:Math.round((v-165)*255/80);
        p[i]=p[i+1]=p[i+2]=contrast;p[i+3]=255;
      }
      ctx.putImageData(data,0,0);
    }
    return canvas;
  }

  async function prepare(file){
    if(!file || !/^image\/(png|jpeg|webp)$/.test(file.type))throw new TypeError("Unsupported image");
    let image, revoke;
    try{
      if(typeof createImageBitmap==="function") image=await createImageBitmap(file);
      else{
        const url=URL.createObjectURL(file);
        revoke=()=>URL.revokeObjectURL(url);
        image=await new Promise((resolve,reject)=>{
          const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error("이미지를 열지 못했습니다."));img.src=url;
        });
      }
      const originalWidth=image.width||image.naturalWidth,originalHeight=image.height||image.naturalHeight;
      if(!originalWidth||!originalHeight)throw new Error("이미지 크기를 읽지 못했습니다.");
      const factor=Math.min(1,1800/originalWidth,1800/originalHeight);
      const source=document.createElement("canvas");
      source.width=Math.max(1,Math.round(originalWidth*factor));
      source.height=Math.max(1,Math.round(originalHeight*factor));
      const ctx=source.getContext("2d",{willReadFrequently:true});
      ctx.fillStyle="white";ctx.fillRect(0,0,source.width,source.height);
      ctx.drawImage(image,0,0,source.width,source.height);
      const pixels=ctx.getImageData(0,0,source.width,source.height).data;
      const layout=inspect(pixels,source.width,source.height);
      if(layout.blank)return {regions:[upscale(source,layout.regions[0],false)],columns:1,cropped:false,originalWidth,originalHeight};
      // Mostly-white screenshots get text contrast normalization; photos do not.
      const enhance=layout.regions.length>1 || (layout.cropped && layout.regions[0].width*layout.regions[0].height<source.width*source.height*.82);
      return {regions:layout.regions.map(rect=>upscale(source,rect,enhance)),columns:layout.columns,cropped:layout.cropped,originalWidth,originalHeight};
    }finally{
      if(revoke)revoke();
      if(image && typeof image.close==="function")image.close();
    }
  }
  return {inspect,prepare,segmentationMode,lowResolution};
});
