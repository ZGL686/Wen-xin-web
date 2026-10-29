-- Shapes and mesh nodes can expose snapshots in different coordinate spaces.
-- Compare evaluated vertices to the native world bounds before baking.
global keyboardWorldMesh
fn keyboardWorldMesh n = (
 local msh=snapshotAsMesh n
 local nativeBB=nodeGetBoundingBox n (matrix3 1)
 local loA=[1e9,1e9,1e9];local hiA=[-1e9,-1e9,-1e9]
 local loB=[1e9,1e9,1e9];local hiB=[-1e9,-1e9,-1e9]
 for i=1 to msh.numverts do (
  local a=getVert msh i;local b=a*n.objectTransform
  for j=1 to 3 do (loA[j]=amin loA[j] a[j];hiA[j]=amax hiA[j] a[j];loB[j]=amin loB[j] b[j];hiB[j]=amax hiB[j] b[j])
 )
 local ea=distance loA nativeBB[1]+distance hiA nativeBB[2]
 local eb=distance loB nativeBB[1]+distance hiB nativeBB[2]
 if eb<ea do (for i=1 to msh.numverts do setVert msh i ((getVert msh i)*n.objectTransform))
 msh
)
