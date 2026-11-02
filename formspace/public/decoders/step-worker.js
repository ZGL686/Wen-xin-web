/* STEP tessellation stays off the UI thread. The worker is terminated after each job. */
importScripts('/decoders/occt/occt-import-js.js');
self.onmessage = async ({ data }) => {
  try {
    const occt = await occtimportjs({ locateFile: name => '/decoders/occt/' + name });
    const result = occt.ReadStepFile(new Uint8Array(data), { linearUnit: 'meter', linearDeflectionType: 'bounding_box_ratio', linearDeflection: .001, angularDeflection: .5 });
    if (!result.success || !result.meshes?.length) throw new Error('STEP 中没有可显示的曲面，请检查文件或另附 GLB 预览。');
    const transfers = [];
    const meshes = result.meshes.map(part => {
      const positions = new Float32Array(part.attributes.position.array);
      const indices = new Uint32Array(part.index.array);
      const normals = part.attributes.normal ? new Float32Array(part.attributes.normal.array) : null;
      transfers.push(positions.buffer, indices.buffer); if (normals) transfers.push(normals.buffer);
      return { name: part.name, color: part.color, faces: part.brep_faces, positions, normals, indices };
    });
    self.postMessage({ meshes }, transfers);
  } catch (error) { self.postMessage({ error: error.message || 'STEP 解析失败，请检查文件内容。' }); }
};
