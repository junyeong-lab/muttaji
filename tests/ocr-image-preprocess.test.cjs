"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {segmentationMode,lowResolution,inspect}=require("../assets/ocr-image-preprocess.js");

test("기본 인식과 작은 문자 재시도는 서로 다른 페이지 분할 방식을 선택한다",()=>{
  assert.equal(segmentationMode("table"),"4");
  assert.equal(segmentationMode("single-block"),"6");
  assert.equal(segmentationMode("invalid"),"4");
});

test("원본 해상도 899x218은 작은 이미지 경고를 표시할 조건이다",()=>{
  assert.equal(lowResolution(899,218),true);
  assert.equal(lowResolution(1920,1080),false);
  assert.equal(lowResolution(0,0),false);
  assert.equal(lowResolution(undefined,200),false);
});

test("픽셀이 비어있는 이미지도 인식 영역을 유지하며 임의 문장을 만들지 않는다",()=>{
  const width=50,height=30,pixels=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<pixels.length;i+=4){pixels[i]=255;pixels[i+1]=255;pixels[i+2]=255;pixels[i+3]=255;}
  const result=inspect(pixels,width,height);
  assert.equal(result.blank,true);
  assert.equal(result.columns,1);
  assert.equal(result.regions.length,1);
});
