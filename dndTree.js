treeJSON = d3.json("/flare.json", function(error, treeData) {
  var isShow = false;
  var state = true;
  // Calcule le nombre total de nœuds
  var totalNodes = 0;
  var maxLabelLength = 0;
  // variables for drag/drop
  var selectedNode = null;
  var draggingNode = null;
  // panning variables
  var panSpeed = 200;
  var panBoundary = 20; 
  // Misc. variables
  var i = 0;
  var duration = 750;
  var root;

  // dimention diagram
  var viewerWidth = 800;
  var viewerHeight = 400;

  var tree = d3.layout.tree()
    .size([viewerHeight, viewerWidth]);

  // définit une projection diagonale d3 à utiliser ultérieurement par les link.
  var diagonal = d3.svg.diagonal()
    .projection(function(d) {
      return [d.y, d.x];
    });

  // Une fonction récursive pour effectuer une configuration en parcourant tous les nœuds

  function visit(parent, visitFn, childrenFn) {
    if (!parent) return;

    visitFn(parent);

    var children = childrenFn(parent);
    if (children) {
      var count = children.length;
      for (var i = 0; i < count; i++) {
        visit(children[i], visitFn, childrenFn);
      }
      console.log('children', children)
    }
  }

  // Calcule le maxLabelLength
  visit(treeData, function(d) {
    totalNodes++;
    maxLabelLength = Math.max(d.name.length, maxLabelLength);

  }, function(d) {
    return d.children && d.children.length > 0 ? d.children : null;
  });


  // sort the tree according to the node names

  function sortTree() {
    tree.sort(function(a, b) {
      return b.name.toLowerCase() < a.name.toLowerCase() ? 1 : -1;
    });
  }
  // trier l'arbre en fonction des noms de noeud
  sortTree();

 

  function pan(domNode, direction) {
    var speed = panSpeed;
    if (panTimer) {
      clearTimeout(panTimer);
      translateCoords = d3.transform(svgGroup.attr("transform"));
      if (direction == 'left' || direction == 'right') {
        translateX = direction == 'left' ? translateCoords.translate[0] + speed : translateCoords.translate[0] - speed;
        translateY = translateCoords.translate[1];
      } else if (direction == 'up' || direction == 'down') {
        translateX = translateCoords.translate[0];
        translateY = direction == 'up' ? translateCoords.translate[1] + speed : translateCoords.translate[1] - speed;
      }
      scaleX = translateCoords.scale[0];
      scaleY = translateCoords.scale[1];
      scale = zoomListener.scale();
      svgGroup.transition().attr("transform", "translate(" + translateX + "," + translateY + ")scale(" + scale + ")");
      d3.select(domNode).select('g.node').attr("transform", "translate(" + translateX + "," + translateY + ")");
      zoomListener.scale(zoomListener.scale());
      zoomListener.translate([translateX, translateY]);
      panTimer = setTimeout(function() {
        pan(domNode, speed, direction);
      }, 50);
    }
  }



  function zoom() {
    svgGroup.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
  }

  var zoomListener = d3.behavior.zoom().scaleExtent([0.1, 3]).on("zoom", zoom);

  function initiateDrag(d, domNode) {
    draggingNode = d;
    d3.select(domNode).select('.ghostCircle').attr('pointer-events', 'none');
    d3.selectAll('.ghostCircle').attr('class', 'ghostCircle show');
    d3.select(domNode).attr('class', 'node activeDrag');

    svgGroup.selectAll("g.node").sort(function(a, b) { // select the parent and sort the path's
      if (a.id != draggingNode.id) return 1; // a is not the hovered element, send "a" to the back
      else return -1; // a is the hovered element, bring "a" to the front
    });
    // si les noeuds ont des enfants, supprimez les liens et les noeuds
    if (nodes.length > 1) {
      // remove link paths
      links = tree.links(nodes);
      nodePaths = svgGroup.selectAll("path.link")
        .data(links, function(d) {
          return d.target.id;
        }).remove();
      // remove noeuds des enfants
      nodesExit = svgGroup.selectAll("g.node")
        .data(nodes, function(d) {
          return d.id;
        }).filter(function(d, i) {
          if (d.id == draggingNode.id) {
            return false;
          }
          return true;
        }).remove();
    }

    // remove parent link
    parentLink = tree.links(tree.nodes(draggingNode.parent));
    svgGroup.selectAll('path.link').filter(function(d, i) {
      if (d.target.id == draggingNode.id) {
        return true;
      }
      return false;
    }).remove();

    dragStarted = null;
  }


  var baseSvg = d3.select("#tree-container").append("svg")
    .attr("width", viewerWidth)
    .attr("height", viewerHeight)
    .attr("class", "overlay")
    .call(zoomListener);


  //Définit les dragListener pour le glisser-déposer des nœuds.
  dragListener = d3.behavior.drag()
    .on("dragstart", function(d) {
      if (d == root) {
        return;
      }
      dragStarted = true;
      nodes = tree.nodes(d);
      d3.event.sourceEvent.stopPropagation();
      // Il est important que nous supprimions l'événement mouseover sur le nœud qui est déplacé. Sinon, il absorbera l'événement mouseover et le nœud sous-jacent ne le détectera pas. D3.select (this) .attr ('pointer-events', 'none');
    })
    .on("drag", function(d) {
      if (d == root) {
        return;
      }
      if (dragStarted) {
        domNode = this;
        initiateDrag(d, domNode);
      }

      // obtenir les coordonnées de mouseEvent par rapport au conteneur svg pour permettre le panoramique
      relCoords = d3.mouse($('svg').get(0));
      if (relCoords[0] < panBoundary) {
        panTimer = true;
        pan(this, 'left');
      } else if (relCoords[0] > ($('svg').width() - panBoundary)) {
        panTimer = true;
        pan(this, 'right');
      } else if (relCoords[1] < panBoundary) {
        panTimer = true;
        pan(this, 'up');
      } else if (relCoords[1] > ($('svg').height() - panBoundary)) {
        panTimer = true;
        pan(this, 'down');
      } else {
        try {
          clearTimeout(panTimer);
        } catch (e) {

        }
      }

      d.x0 += d3.event.dy;
      d.y0 += d3.event.dx;
      var node = d3.select(this);
      node.attr("transform", "translate(" + d.y0 + "," + d.x0 + ")");
      updateTempConnector();
    }).on("dragend", function(d) {
      if (d == root) {
        return;
      }
      domNode = this;
      if (selectedNode) {
        // maintenant retirer l'élément du parent, et l'insérer dans les nouveaux éléments enfants
        var index = draggingNode.parent.children.indexOf(draggingNode);
        if (index > -1) {
          draggingNode.parent.children.splice(index, 1);
        }
        if (typeof selectedNode.children !== 'undefined' || typeof selectedNode._children !== 'undefined') {
          if (typeof selectedNode.children !== 'undefined') {
            selectedNode.children.push(draggingNode);
          } else {
            selectedNode._children.push(draggingNode);
          }
        } else {
          selectedNode.children = [];
          selectedNode.children.push(draggingNode);
        }
        // Assurez-vous que le noeud ajouté est élargi afin que l'utilisateur puisse voir que le noeud ajouté est correctement déplacé
        expand(selectedNode);
        sortTree();
        endDrag();
      } else {
        endDrag();
      }
    });

  function endDrag() {
    selectedNode = null;
    d3.selectAll('.ghostCircle').attr('class', 'ghostCircle');
    d3.select(domNode).attr('class', 'node');
    // maintenant restaurer l'événement mouseover ou nous ne serons pas en mesure de faire glisser une 2ème fois
    d3.select(domNode).select('.ghostCircle').attr('pointer-events', '');
    updateTempConnector();
    if (draggingNode !== null) {
      update(root);
      centerNode(draggingNode);
      draggingNode = null;
    }
  }


  function collapse(d) {
    if (d.children) {
      d._children = d.children;
      d._children.forEach(collapse);
      d.children = null;
    }
  }

  function expand(d) {
    if (d._children) {
      d.children = d._children;
      d.children.forEach(expand);
      d._children = null;
    }
  }

  var overCircle = function(d) {
    selectedNode = d;
    updateTempConnector();
  };
  var outCircle = function(d) {
    selectedNode = null;
    updateTempConnector();
  };

  var updateTempConnector = function() {
    var data = [];
    if (draggingNode !== null && selectedNode !== null) {
    
      data = [{
        source: {
          x: selectedNode.y0,
          y: selectedNode.x0
        },
        target: {
          x: draggingNode.y0,
          y: draggingNode.x0
        }
      }];

    }
    var link = svgGroup.selectAll(".templink").data(data);

    link.enter().append("path")
      .attr("class", "templink")
      .attr("d", d3.svg.diagonal())
      .attr('pointer-events', 'none');

    link.attr("d", d3.svg.diagonal());

    link.exit().remove();
  };

 
var count = true;
  function centerNode(source) {
    var count2 = 0;
    if (count === true ){
      count2  = 300;
      count = false;
    } else {
      count2 = 0;
    }
    scale = zoomListener.scale();
    x = -source.y0 - count2;
    y = -source.x0;
    x = x * scale + viewerWidth / 2;
    y = y * scale + viewerHeight / 2;
    d3.select('g').transition()
      .duration(duration)
      .attr("transform", "translate(" + x + "," + y + ")scale(" + scale + ")");
    zoomListener.scale(scale);
    zoomListener.translate([x, y]);
  }



  function toggleChildren(d) {
    if (d.children) {
      d._children = d.children;
      d.children = null;
    } else if (d._children) {
      d.children = d._children;
      d._children = null;
    }
    return d;
  }



  function click(d) {
if (state) {
  if (d3.event.defaultPrevented) return; 
  d = toggleChildren(d);
  circleSize(d);
  update(d);
  centerNode(d);
  state = false;
}
  }
function circleSize(e) {
     d3.selectAll('circle.nodeCircle')
       .transition()
       .duration(duration)
       .attr("r", function(d){
         console.log('ddddd',d);
         var temp = 10;
         if( e.name === d.name) {
           temp = 1000;
           d3.selectAll('text.nodeTextF')
             .style('display', 'none');
           d3.selectAll('text.nodeText')
             .style('display', 'none');
           d3.select(".button_seting")
             .style('display', 'none');
           isShow = true;
           interUpdate(e);
         }

         return  temp;
       });
}
function interUpdate(e) {
  d3.select('.titre_change_node').text(function () {
    var temp = 'La condition est: ' + e.name;
    if(e.type === 'cible'){
     temp = 'Filtrer par:'+ ' '+ e.name;
    } 
    return temp;
  });
d3.select('.container_undate').style('display','block')
}

  function update(source) {
    var levelWidth = [1];
    var childCount = function(level, n) {
      if (n.children && n.children.length > 0) {
        if (levelWidth.length <= level + 1) levelWidth.push(0);

        levelWidth[level + 1] += n.children.length;
        n.children.forEach(function(d) {
          childCount(level + 1, d);
        });
      }
    };
    childCount(0, root);
    var newHeight = d3.max(levelWidth) * 50; 
    tree = tree.size([newHeight, viewerWidth]);

  
    var nodes = tree.nodes(root).reverse(),
      links = tree.links(nodes);

  
    nodes.forEach(function(d) {
      d.y = (d.depth * (maxLabelLength * 10)); 
    });

 
    node = svgGroup.selectAll("g.node")
      .data(nodes, function(d) {
        return d.id || (d.id = ++i);
      });

    var nodeEnter = node.enter().append("g")
      .call(dragListener)
      .attr("class", "node")
      .attr("transform", function(d) {
        return "translate(" + source.y0 + "," + source.x0 + ")";
      })
      .on('click', click)
      .on("mouseover", function(d) {
    if (!isShow){
      d3.select('body').selectAll('text.nodeTextF')
        .style("display", function(q) {

          if (q.name === d.name) {
            return 'block';
          }
          else if (q.depth === 0){
            return 'block';
          }
          else {
            return 'none'
          }})
        .style("fill", function() {
          if (d.type === "cible") {
            return '#CDDC39';
          }
          else if (d.type === "condition"){
            return '#FF9800';
          }else if (d.depth === 0){
            return '#03A9F4';
          }
          else {
            return '#03A9F4'
          }});
    } else {

    }

      });
    nodeEnter.append("circle")
      .attr('class', 'nodeCircle')
      .attr("r", 0)
      .style("fill", function(d) {
        return d._children ? "#616161" : "#616161";
      });

    nodeEnter.append("text")
      .attr("x", function(d) {
        return d.children || d._children ? -10 : 10;
      })
      .attr("dy", ".35em")
      .attr('class' , function(d) {
        if (d.depth === 0) {
          return 'nodeText';
        } else {
         return 'nodeTextF';
        }
      } )
      .attr("text-anchor", function(d) {
        return d.children || d._children ? "end" : "start";
      })
      .text(function(d) {

        return d.name;
      })
      .style("display", function(d) {
        if (d.depth === 0) {
          return 'block';
        }else {
          return 'none'
        }
      })
      .style("fill-opacity", 0);


    nodeEnter.append("circle")
      .attr('class', 'ghostCircle')
      .attr("r", 50)
      .attr("opacity", 0.2) // change this to zero to hide the target area
      .style("fill", "red")
      .attr('pointer-events', 'mouseover')
      .on("mouseover", function(node) {
        overCircle(node);
      })
      .on("mouseout", function(node) {
        outCircle(node);
      });

   
    node.select('text')
      .attr("x", function(d) {
        return d.children || d._children ? -10 : 10;
      })
      .attr("text-anchor", function(d) {
        return d.children || d._children ? "end" : "start";
      })
      .text(function(d) {
        return d.name;
      });

    node.select("circle.nodeCircle")
      .attr("r", 7)
      .style("fill", function(d) {
        return d._children ? "#616161" : "#616161";
      });

  
    var nodeUpdate = node.transition()
      .duration(duration)
      .attr("transform", function(d) {
        return "translate(" + d.y + "," + d.x + ")";
      });

  
    nodeUpdate.select("text")
      .style("fill-opacity", 1);

   
    var nodeExit = node.exit().transition()
      .duration(duration)
      .attr("transform", function(d) {
        return "translate(" + source.y + "," + source.x + ")";
      })
      .remove();

    nodeExit.select("circle")
      .attr("r", 0);

    nodeExit.select("text")
      .style("fill-opacity", 0);

  
    var link = svgGroup.selectAll("path.link")
      .data(links, function(d) {
        return d.target.id;
      });

  
    link.enter().insert("path", "g")
      .attr("class", "link")
      .attr("d", function(d) {
        var o = {
          x: source.x0,
          y: source.y0
        };

        return diagonal({
          source: o,
          target: o
        });
      });


    link.transition()
      .duration(duration)
      .attr("d", diagonal);

    link.exit().transition()
      .duration(duration)
      .attr("d", function(d) {
        var o = {
          x: source.x,
          y: source.y
        };
        return diagonal({
          source: o,
          target: o
        });
      })
      .remove();

 
    nodes.forEach(function(d) {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }


  var svgGroup = baseSvg.append("g");

  root = treeData;
  root.x0 = viewerHeight / 2;
  root.y0 = 0;


  update(root);
  centerNode(root);

  d3.select('#list-checkbox-1')
    .on('change',function() {
      if (!isShow) {
        d3.select('body').selectAll('text.nodeTextF')
              .style("display", 'block')
              .style("fill", function(d) {

                if (d.type === "cible") {
                  return '#CDDC39';
                }
                else if (d.type === "condition"){
                  return '#FF9800';
                }else if (d.depth === 0){
                  return '#03A9F4';
                }
                else {
                  return '#03A9F4'
                }});
        isShow = true;
      }
      else {
        d3.selectAll(".node")
          .on('click', click)
          .on("mouseover", function(d) {
            if (!isShow) {
              d3.select('body').selectAll('text.nodeTextF')
                .style("display", function (q) {

                  if (q.name === d.name) {
                    return 'block';
                  }
                  else if (q.depth === 0) {
                    return 'block';
                  }
                  else {
                    return 'none'
                  }
                })
                .style("fill", function () {
                  if (d.type === "cible") {
                    return '#CDDC39';
                  }
                  else if (d.type === "condition") {
                    return '#FF9800';
                  } else if (d.depth === 0) {
                    return '#03A9F4';
                  }
                  else {
                    return '#03A9F4'
                  }
                });
            } else {

            }
          });
        isShow = false;
      }
    });

});
