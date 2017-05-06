/////////////////////////////////////////////////////////////////
// SelectionFilter Viewer Extension
// By Philippe Leefsma, Autodesk Inc, April 2017
//
/////////////////////////////////////////////////////////////////
import ExtensionBase from 'Viewer.ExtensionBase'
import WidgetContainer from 'WidgetContainer'
import FilterTreeView from './FilterTreeView'
import EventTool from 'Viewer.EventTool'
import Toolkit from 'Viewer.Toolkit'
import { ReactLoader } from 'Loader'
import ReactDOM from 'react-dom'
import Switch from 'Switch'
import Label from 'Label'
import React from 'react'

class SelectionFilterExtension extends ExtensionBase {

	/////////////////////////////////////////////////////////////////
	// Class constructor
  //
	/////////////////////////////////////////////////////////////////
	constructor (viewer, options) {

		super (viewer, options)

    this.onNodeChecked = this.onNodeChecked.bind(this)
    this.onSelection = this.onSelection.bind(this)
    this.renderTitle = this.renderTitle.bind(this)

    this.eventTool = new EventTool(this.viewer)

    this.eventSink = options.eventSink

    this.react = options.react

    this.leafNodesMap = {}
	}

	/////////////////////////////////////////////////////////
	// Load callback
  //
  /////////////////////////////////////////////////////////
	load () {

    this.eventSink.on('model.loaded', () => {

      if (this.options.loader) {

        this.options.loader.hide()
      }

      this.initLoadEvents ()
    })

    this.react.setState({

      models: []

    }).then (() => {

      this.react.pushRenderExtension(this)
    })

    this.eventTool.on ('buttondown', () => {

      this.mouseDown = true

      return false
    })

    this.eventTool.on ('buttonup', (event) => {

      this.mouseDown = false

      return false
    })

    this.eventTool.on ('mousemove', (event) => {

      // model.rayIntersect cannot be used in this scenario
      // because needs to check for every component
      // for intersection

      //const raycaster = this.pointerToRaycaster(event)
      //const hitTest = this.viewer.model.rayIntersect(
      //  raycaster, true, dbIds)

      if (!this.mouseDown) {

        const hitTest = this.viewer.clientToWorld(
          event.canvasX,
          event.canvasY,
          true)

        if (hitTest) {

          const {guid} = hitTest.model

          return !this.leafNodesMap[guid][hitTest.dbId]
        }
      }

      return false
    })

    this.viewer.loadDynamicExtension(
      'Viewing.Extension.ContextMenu').then (
        (ctxMenuExtension) => {

          ctxMenuExtension.on('buildMenu', (params) => {

            const guid = params.model
              ? params.model.guid
              : ''

            const dbId = params.dbId

            return (!dbId || this.leafNodesMap[guid][dbId])
              ? params.menu
              : []
          })
        })

    this.viewer.addEventListener(
      Autodesk.Viewing.AGGREGATE_SELECTION_CHANGED_EVENT,
      this.onSelection)

    console.log('Viewing.Extension.SelectionFilter loaded')

		return true
	}

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  get className() {

    return 'selection-filter'
  }

  /////////////////////////////////////////////////////////
	// Extension Id
  //
  /////////////////////////////////////////////////////////
	static get ExtensionId () {

		return 'Viewing.Extension.SelectionFilter'
	}

  /////////////////////////////////////////////////////////
	// Unload callback
  //
  /////////////////////////////////////////////////////////
	unload () {

    this.viewer.removeEventListener(
      Autodesk.Viewing.AGGREGATE_SELECTION_CHANGED_EVENT,
      this.onSelection)

    this.eventTool.deactivate()

    console.log('Viewing.Extension.SelectionFilter unloaded')

		return true
	}

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  initLoadEvents () {

    this.viewerEvent([

      Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT,
      Autodesk.Viewing.GEOMETRY_LOADED_EVENT

    ]).then((args) => {

      this.onModelFullyLoaded(args)
    })

    this.eventTool.deactivate()
  }

  async onModelFullyLoaded (args) {

    const {models} = this.react.getState()

    const model = args[0].model

    this.react.setState({
      models: [...models, model]
    })

    this.leafNodesMap[model.guid] = {}

    Toolkit.getLeafNodes (model).then((dbIds) => {

      dbIds.forEach((dbId) => {

        this.leafNodesMap[model.guid][dbId] = true
      })
    })

    this.eventTool.activate()

    return true
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  onSelection (e) {

    if (e.selections.length) {

      const selection = e.selections[0]

      const dbId = selection.dbIdArray[0]

      const model = selection.model

      if (!this.leafNodesMap[model.guid][dbId]) {

        setTimeout(() => {
          this.viewer.clearSelection()
        }, 300)

        this.viewer.clearSelection()
      }
    }
  }

  /////////////////////////////////////////////////////////
  // Creates Raycastser object from the pointer
  //
  /////////////////////////////////////////////////////////
  pointerToRaycaster (pointer) {

    const camera = this.viewer.navigation.getCamera()
    const domContainer = this.viewer.container
    const pointerVector = new THREE.Vector3()
    const pointerDir = new THREE.Vector3()
    const raycaster = new THREE.Raycaster()

    const r = domContainer.getBoundingClientRect()

    const x =  ((pointer.clientX - r.left) / r.width)  * 2 - 1
    const y = -((pointer.clientY - r.top)  / r.height) * 2 + 1

    if (camera.isPerspective) {

      pointerVector.set(x, y, 0.5)

      pointerVector.unproject(camera)

      raycaster.set(camera.position,
        pointerVector.sub(
          camera.position).normalize())

    } else {

      pointerVector.set(x, y, -1)

      pointerVector.unproject(camera)

      pointerDir.set(0, 0, -1)

      raycaster.set(pointerVector,
        pointerDir.transformDirection(
          camera.matrixWorld))
    }

    return raycaster
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  onNodeChecked (model, node) {

    Toolkit.getLeafNodes (model, node.id).then((dbIds) => {

      dbIds.forEach((dbId) => {

        this.leafNodesMap[model.guid][dbId] = node.checked
      })
    })
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  async setDocking (docked) {

    const id = SelectionFilterExtension.ExtensionId

    if (docked) {

      await this.react.popRenderExtension(id)

      this.react.pushViewerPanel(this, {
        height: 250,
        width: 350
      })

    } else {

      await this.react.popViewerPanel(id)

      this.react.pushRenderExtension(this)
    }
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  renderTitle (docked) {

    const spanClass = docked
      ? 'fa fa-chain-broken'
      : 'fa fa-chain'

    return (
      <div className="title">
        <label>
          Selection Filter
        </label>
        <div className="selection-filter-controls">
          <button onClick={() => this.setDocking(docked)}
            title="Toggle docking mode">
            <span className={spanClass}/>
          </button>
        </div>
      </div>
    )
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  renderContent () {

    const { models } = this.react.getState()

    //console.log(models)

    const treeViews = models.map((model) => {

      return (
        <FilterTreeView onNodeChecked={this.onNodeChecked}
          viewer={this.viewer}
          key={model.guid}
          model={model}/>
      )
    })

    return (
      <div className="content">
        <ReactLoader show={!models.length}/>
        { treeViews }
      </div>
    )
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  render (opts) {

    return (
      <WidgetContainer
        renderTitle={() => this.renderTitle(opts.docked)}
        showTitle={opts.showTitle}
        className={this.className}>

        { this.renderContent () }

      </WidgetContainer>
    )
  }
}

Autodesk.Viewing.theExtensionManager.registerExtension (
  SelectionFilterExtension.ExtensionId,
  SelectionFilterExtension)

export default 'Viewing.Extension.SelectionFilter'
